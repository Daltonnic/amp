/**
 * Email copy for accountability messages. Pure TypeScript with no runtime
 * dependencies, so it is shared by the `send-support-email` edge function
 * (Deno) and the app's mail-composer fallback (Vite).
 *
 * Wording is carried over from the original AMP app.
 */

export type EmailKind = 'support' | 'check_in_request'

export interface EmailContent {
  subject: string
  body: string
}

const SIGNATURE = 'Sent through AMP: The Journey'

export function composeEmail(input: {
  kind: EmailKind
  contactName: string
  senderName?: string
  checkInSummary?: string
}): EmailContent {
  const sender = input.senderName?.trim()
  if (input.kind === 'support') {
    const summary = input.checkInSummary?.trim() || summarizeCheckIn(null)
    return {
      subject: 'I need support right now',
      body: [
        `Hi ${input.contactName},`,
        '',
        "I'm reaching out because I need support right now.",
        '',
        summary,
        '',
        "Please pray for me, reach out, or simply let me know you're there.",
        '',
        sender ? `— ${sender}` : null,
        sender ? '' : null,
        SIGNATURE,
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
    }
  }
  return {
    subject: 'Check-In Request',
    body: [
      sender
        ? `This is a message from ${sender}, who trusts you.`
        : 'This is a message from someone who trusts you.',
      '',
      'They\'re reaching out because they need a check-in. No details required — just your presence, a prayer, or a simple "I\'m here."',
      '',
      'This message was sent through AMP: The Journey.',
    ].join('\n'),
  }
}

/** One-line description of today's check-in for the "I Need Support" email. */
export function summarizeCheckIn(
  checkIn: {
    emotional_state: string
    custom_emotion?: string
    intensity: number | null
    temptation_level: number | null
  } | null,
): string {
  if (!checkIn) return "I haven't completed today's check-in yet."
  const feeling = checkIn.emotional_state || checkIn.custom_emotion || 'unsettled'
  const parts = [`Today's check-in: feeling "${feeling}"`]
  if (checkIn.intensity) parts.push(` (intensity ${checkIn.intensity}/10)`)
  if (checkIn.temptation_level) parts.push(`, temptation level ${checkIn.temptation_level}/10`)
  return parts.join('') + '.'
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function toHtml(body: string): string {
  const paragraphs = body
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#152340;max-width:560px;margin:0 auto;padding:24px">${paragraphs}</body></html>`
}
