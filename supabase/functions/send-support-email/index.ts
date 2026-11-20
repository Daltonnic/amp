/**
 * send-support-email
 *
 * Replaces Base44's `integrations.Core.SendEmail` for the "I Need Support"
 * button (Home) and "Request Check-In" (Accountability).
 *
 * The client never chooses the recipient: it sends a contact id, and the
 * address is looked up under the caller's own Row Level Security, so this
 * cannot be used to email arbitrary people. Sends are rate limited.
 *
 * Secrets: RESEND_API_KEY, EMAIL_FROM (e.g. "AMP: The Journey <care@yourdomain.org>")
 */
import { composeEmail, toHtml, type EmailKind } from '../_shared/emails.ts'
import {
  adminClient,
  authenticate,
  corsHeaders,
  countRecent,
  DAY,
  HOUR,
  json,
  requireEnv,
} from '../_shared/http.ts'

const LIMIT_PER_HOUR = 5
const LIMIT_PER_DAY = 20

interface Body {
  contactId?: unknown
  kind?: unknown
  checkInSummary?: unknown
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  try {
    const auth = await authenticate(req)
    if (!auth) return json(req, 401, { error: 'Please sign in again.' })

    const body = (await req.json().catch(() => ({}))) as Body
    const kind = body.kind as EmailKind
    if (typeof body.contactId !== 'string' || (kind !== 'support' && kind !== 'check_in_request')) {
      return json(req, 400, { error: 'Invalid request.' })
    }
    const checkInSummary =
      typeof body.checkInSummary === 'string' ? body.checkInSummary.slice(0, 300) : undefined

    // Recipient lookup runs as the user: RLS guarantees it is their own contact.
    const { data: contact, error: contactError } = await auth.userClient
      .from('accountability_contacts')
      .select('id, name, email')
      .eq('id', body.contactId)
      .maybeSingle()
    if (contactError) throw contactError
    if (!contact) return json(req, 404, { error: 'Contact not found.' })
    if (!contact.email) return json(req, 400, { error: 'No email on file for this contact.' })

    const admin = adminClient()
    const [lastHour, lastDay] = await Promise.all([
      countRecent(admin, 'outbound_emails', auth.user.id, HOUR),
      countRecent(admin, 'outbound_emails', auth.user.id, DAY),
    ])
    if (lastHour >= LIMIT_PER_HOUR || lastDay >= LIMIT_PER_DAY) {
      return json(req, 429, {
        error: "You've sent several messages recently. Please call or text your contact directly.",
      })
    }

    const { data: profile } = await auth.userClient.from('profiles').select('display_name').maybeSingle()
    const email = composeEmail({
      kind,
      contactName: contact.name,
      senderName: profile?.display_name || undefined,
      checkInSummary,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requireEnv('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: requireEnv('EMAIL_FROM'),
        to: [contact.email],
        // Replies go straight to the person who asked for support.
        reply_to: auth.user.email ? [auth.user.email] : undefined,
        subject: email.subject,
        text: email.body,
        html: toHtml(email.body),
      }),
    })
    if (!res.ok) {
      console.error('Resend error', res.status, await res.text())
      return json(req, 502, { error: "We couldn't send the email. Please try again or call them directly." })
    }

    await admin.from('outbound_emails').insert({ user_id: auth.user.id, contact_id: contact.id, kind })
    return json(req, 200, { ok: true })
  } catch (err) {
    console.error(err)
    return json(req, 500, { error: 'Something went wrong. Please try again.' })
  }
})
