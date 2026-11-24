/**
 * Sends push notifications, so people hear about these even when AMP is closed:
 * - a new group message → the other members of that group
 *   (public.push_recipients(): approved members, minus anyone who blocked the author);
 * - someone asked to join a group → every leader;
 * - a leader approved a request → that person.
 *
 * Called by the database through pg_net (triggers chat_messages_push and
 * chat_members_push → public.push_webhook) with a shared secret. Body:
 * { message_id } or { event: 'join_request' | 'join_approved', user_id }.
 *
 * Secrets: PUSH_WEBHOOK_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
 * VAPID_SUBJECT. Optional, for the store apps: FCM_SERVICE_ACCOUNT (JSON) and
 * APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, requireEnv } from '../_shared/http.ts'
import {
  groupNotification,
  joinRequestNotification,
  welcomeNotification,
  type GroupNotification,
} from '../_shared/groupNotification.ts'
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

const UUID = /^[0-9a-f-]{36}$/i
const SUBSCRIPTION_COLUMNS = 'subscription_id:id, user_id, platform, endpoint, p256dh, auth, show_preview'

/** Sends one notification per device; removes devices the push service says are gone. */
async function deliver(
  db: SupabaseClient,
  list: Recipient[],
  build: (r: Recipient) => GroupNotification,
): Promise<Record<string, number>> {
  if (list.length === 0) return { sent: 0 }
  const vapid: VapidKeys = {
    publicKey: requireEnv('VAPID_PUBLIC_KEY'),
    privateKey: requireEnv('VAPID_PRIVATE_KEY'),
    subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://amp-amp-56fd.vercel.app',
  }
  const fcm = optionalJson<FirebaseServiceAccount>('FCM_SERVICE_ACCOUNT')
  const apns = apnsConfig()

  const results = await pool(
    list.map((r) => async (): Promise<PushResult | null> => {
      const n = build(r)
      try {
        if (r.platform === 'web' && r.p256dh && r.auth) {
          return await sendWebPush(
            { endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth },
            JSON.stringify(n),
            vapid,
            // Stacking notifications replace each other while waiting for delivery.
            { urgency: 'high', topic: n.stack ? n.tag : undefined },
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
  return {
    sent: results.filter((r) => r?.ok).length,
    failed: failed.length,
    removed: gone.length,
    skipped: results.filter((r) => r === null).length,
  }
}

async function messagePosted(db: SupabaseClient, messageId: string) {
  const { data: message } = await db
    .from('chat_messages')
    .select('id, room, user_id, kind, body, reply_to, deleted_at')
    .eq('id', messageId)
    .maybeSingle()
  if (!message || message.kind !== 'text' || message.deleted_at) return { sent: 0 }

  const [author, room, parent, recipients] = await Promise.all([
    db.from('chat_members').select('display_name').eq('user_id', message.user_id).maybeSingle(),
    db.from('chat_rooms').select('name').eq('id', message.room).maybeSingle(),
    message.reply_to
      ? db.from('chat_messages').select('user_id').eq('id', message.reply_to).maybeSingle()
      : Promise.resolve({ data: null }),
    db.rpc('push_recipients', { message_id: message.id }),
  ])
  if (recipients.error) throw new Error(`push_recipients failed: ${recipients.error.message}`)
  const parentAuthor = (parent.data as { user_id: string } | null)?.user_id ?? null
  return deliver(db, (recipients.data ?? []) as Recipient[], (r) =>
    groupNotification({
      messageId: message.id,
      roomName: room.data?.name ?? 'Your group',
      authorName: author.data?.display_name ?? 'Someone',
      body: message.body,
      preview: r.show_preview,
      replyToYou: parentAuthor === r.user_id,
    }),
  )
}

async function joinRequested(db: SupabaseClient, userId: string) {
  const { data: member } = await db
    .from('chat_members')
    .select('display_name, room, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!member || member.status !== 'pending') return { sent: 0 }
  const [room, leaders] = await Promise.all([
    db.from('chat_rooms').select('name').eq('id', member.room).maybeSingle(),
    db.from('leaders').select('user_id'),
  ])
  const ids = ((leaders.data ?? []) as { user_id: string }[])
    .map((l) => l.user_id)
    .filter((id) => id !== userId)
  if (ids.length === 0) return { sent: 0 }
  const { data: subs } = await db.from('push_subscriptions').select(SUBSCRIPTION_COLUMNS).in('user_id', ids)
  return deliver(db, (subs ?? []) as Recipient[], (r) =>
    joinRequestNotification({
      name: member.display_name,
      roomName: room.data?.name ?? 'a group',
      preview: r.show_preview,
    }),
  )
}

async function joinApproved(db: SupabaseClient, userId: string) {
  const { data: member } = await db
    .from('chat_members')
    .select('room, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (!member || member.status !== 'active') return { sent: 0 }
  const [room, subs] = await Promise.all([
    db.from('chat_rooms').select('name').eq('id', member.room).maybeSingle(),
    db.from('push_subscriptions').select(SUBSCRIPTION_COLUMNS).eq('user_id', userId),
  ])
  return deliver(db, (subs.data ?? []) as Recipient[], (r) =>
    welcomeNotification({ roomName: room.data?.name ?? 'your group', preview: r.show_preview }),
  )
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return respond(405, { error: 'POST only' })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || !(await sameSecret(token, requireEnv('PUSH_WEBHOOK_SECRET')))) {
    return respond(401, { error: 'Not allowed' })
  }

  let body: { message_id?: unknown; event?: unknown; user_id?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return respond(400, { error: 'Expected JSON' })
  }

  const db = adminClient()
  try {
    if (body.event === 'join_request' || body.event === 'join_approved') {
      const userId = String(body.user_id ?? '')
      if (!UUID.test(userId)) return respond(400, { error: 'Bad user_id' })
      return respond(
        200,
        body.event === 'join_request' ? await joinRequested(db, userId) : await joinApproved(db, userId),
      )
    }
    const messageId = String(body.message_id ?? '')
    if (!UUID.test(messageId)) return respond(400, { error: 'Bad message_id' })
    return respond(200, await messagePosted(db, messageId))
  } catch (err) {
    console.error(String(err))
    return respond(500, { error: 'Could not send notifications' })
  }
})
