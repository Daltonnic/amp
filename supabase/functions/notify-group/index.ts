/**
 * Sends push notifications for a new group message, so people hear about it
 * even when AMP is closed.
 *
 * Called by the database (trigger chat_messages_push → pg_net) right after a
 * message is posted, with a shared secret. Recipients are the other active
 * members of that group who turned notifications on, minus anyone who blocked
 * the author (public.push_recipients()).
 *
 * Secrets: PUSH_WEBHOOK_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 * VAPID_SUBJECT. Optional, for the store apps: FCM_SERVICE_ACCOUNT (JSON) and
 * APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID.
 */
import { adminClient, requireEnv } from '../_shared/http.ts'
import { groupNotification } from '../_shared/groupNotification.ts'
import { sendApns, sendFcm, type ApnsConfig, type FirebaseServiceAccount } from '../_shared/nativepush.ts'
import { sendWebPush, utf8, type PushResult, type VapidKeys } from '../_shared/webpush.ts'

interface Recipient {
  subscription_id: string
  user_id: string
  platform: 'web' | 'ios' | 'android'
  endpoint: string
  p256dh: string | null
  auth: string | null
  show_preview: boolean
}

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Compares secrets without leaking how much of them matched. */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(s)))
  const [x, y] = await Promise.all([digest(a), digest(b)])
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

function optionalJson<T>(name: string): T | null {
  const raw = Deno.env.get(name)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    console.error(`${name} is not valid JSON`)
    return null
  }
}

function apnsConfig(): ApnsConfig | null {
  const keyP8 = Deno.env.get('APNS_KEY_P8')
  const keyId = Deno.env.get('APNS_KEY_ID')
  const teamId = Deno.env.get('APNS_TEAM_ID')
  if (!keyP8 || !keyId || !teamId) return null
  return { keyP8, keyId, teamId, bundleId: Deno.env.get('APNS_BUNDLE_ID') ?? 'org.apostolicmoralpurity.app' }
}

/** Runs `tasks` with at most `limit` in flight. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  let next = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]!()
    }
  })
  await Promise.all(workers)
  return results
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return respond(405, { error: 'POST only' })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || !(await sameSecret(token, requireEnv('PUSH_WEBHOOK_SECRET')))) {
    return respond(401, { error: 'Not allowed' })
  }

  let messageId: string
  try {
    messageId = String(((await req.json()) as { message_id?: unknown }).message_id ?? '')
  } catch {
    return respond(400, { error: 'Expected JSON' })
  }
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return respond(400, { error: 'Bad message_id' })

  const db = adminClient()
  const { data: message } = await db
    .from('chat_messages')
    .select('id, room, user_id, kind, body, reply_to, deleted_at')
    .eq('id', messageId)
    .maybeSingle()
  if (!message || message.kind !== 'text' || message.deleted_at) return respond(200, { sent: 0 })

  const [author, room, parent, recipients] = await Promise.all([
    db.from('chat_members').select('display_name').eq('user_id', message.user_id).maybeSingle(),
    db.from('chat_rooms').select('name').eq('id', message.room).maybeSingle(),
    message.reply_to
      ? db.from('chat_messages').select('user_id').eq('id', message.reply_to).maybeSingle()
      : Promise.resolve({ data: null }),
    db.rpc('push_recipients', { message_id: message.id }),
  ])
  if (recipients.error) {
    console.error('push_recipients failed', recipients.error.message)
    return respond(500, { error: 'Could not load recipients' })
  }
  const list = (recipients.data ?? []) as Recipient[]
  if (list.length === 0) return respond(200, { sent: 0 })

  const vapid: VapidKeys = {
    publicKey: requireEnv('VAPID_PUBLIC_KEY'),
    privateKey: requireEnv('VAPID_PRIVATE_KEY'),
    subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://amp-amp-56fd.vercel.app',
  }
  const fcm = optionalJson<FirebaseServiceAccount>('FCM_SERVICE_ACCOUNT')
  const apns = apnsConfig()
  const parentAuthor = (parent.data as { user_id: string } | null)?.user_id ?? null

  const results = await pool(
    list.map((r) => async (): Promise<PushResult | null> => {
      const n = groupNotification({
        messageId: message.id,
        roomName: room.data?.name ?? 'Your group',
        authorName: author.data?.display_name ?? 'Someone',
        body: message.body,
        preview: r.show_preview,
        replyToYou: parentAuthor === r.user_id,
      })
      try {
        if (r.platform === 'web' && r.p256dh && r.auth) {
          return await sendWebPush(
            { endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth },
            JSON.stringify(n),
            vapid,
            // Discreet notifications replace each other while waiting for delivery.
            { urgency: 'high', topic: n.discreet ? 'amp-group' : undefined },
          )
        }
        if (r.platform === 'android' && fcm) return await sendFcm(fcm, r.endpoint, n)
        if (r.platform === 'ios' && apns) return await sendApns(apns, r.endpoint, n)
        return null // That platform isn't set up on the server yet.
      } catch (err) {
        return { ok: false, gone: false, status: 0, detail: String(err).slice(0, 200) }
      }
    }),
    10,
  )

  const gone = list.filter((_, i) => results[i] && !results[i]!.ok && (results[i] as { gone: boolean }).gone)
  if (gone.length) {
    await db
      .from('push_subscriptions')
      .delete()
      .in(
        'id',
        gone.map((r) => r.subscription_id),
      )
  }
  const failed = results.filter((r) => r && !r.ok) as Extract<PushResult, { ok: false }>[]
  for (const f of failed.filter((f) => !f.gone).slice(0, 5)) console.error('push failed', f.status, f.detail)

  return respond(200, {
    sent: results.filter((r) => r?.ok).length,
    failed: failed.length,
    removed: gone.length,
    skipped: results.filter((r) => r === null).length,
  })
})
