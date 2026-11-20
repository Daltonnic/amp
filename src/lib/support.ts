import { composeEmail, summarizeCheckIn, type EmailKind } from '../../supabase/functions/_shared/emails'
import { backend, CloudOnlyError } from '@/data'
import type { AccountabilityContact, CheckIn } from '@/data/types'

export { summarizeCheckIn }

/**
 * Sends an accountability email. With the cloud backend it is sent for the
 * user in one tap; in on-device mode it opens the mail app with the same
 * message ready to send.
 */
export async function contactSupport(input: {
  contact: AccountabilityContact
  kind: EmailKind
  checkIn?: CheckIn | null
  senderName?: string
}): Promise<'sent' | 'composer'> {
  const checkInSummary = input.kind === 'support' ? summarizeCheckIn(input.checkIn ?? null) : undefined
  try {
    await backend.sendSupportEmail({ contactId: input.contact.id, kind: input.kind, checkInSummary })
    return 'sent'
  } catch (err) {
    if (!(err instanceof CloudOnlyError)) throw err
    const email = composeEmail({
      kind: input.kind,
      contactName: input.contact.name,
      senderName: input.senderName,
      checkInSummary,
    })
    const url = `mailto:${encodeURIComponent(input.contact.email)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
    window.location.href = url
    return 'composer'
  }
}
