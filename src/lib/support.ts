import type { AccountabilityContact, CheckIn } from '@/data/types'
import { platform } from './native'

/**
 * "I Need Support" and "Request Check-In" open the person's own Messages app
 * (or email app, if the contact has no mobile number) with a message ready
 * to send. Nothing goes through AMP's servers: it comes from their own phone,
 * so the contact knows exactly who it's from.
 */

export type SupportKind = 'support' | 'check_in_request'
export type Channel = 'text' | 'email'

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/** "anxious, lonely and tired" */
function joinFeelings(feelings: string[]): string {
  const list = feelings.map((f) => f.trim().toLowerCase()).filter(Boolean)
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

/** One sentence about today's check-in, or '' if there isn't one. */
export function summarizeCheckIn(
  checkIn: Pick<CheckIn, 'emotions' | 'custom_emotion' | 'intensity' | 'temptation_level'> | null,
): string {
  if (!checkIn) return ''
  const feelings = joinFeelings([...checkIn.emotions, checkIn.custom_emotion])
  // A level of 0 ("none") isn't worth mentioning in a text.
  const levels = [
    checkIn.intensity ? `intensity ${checkIn.intensity}/10` : null,
    checkIn.temptation_level ? `temptation ${checkIn.temptation_level}/10` : null,
  ].filter(Boolean)
  if (!feelings && levels.length === 0) return ''
  return `Today I'm feeling ${feelings || 'unsettled'}${levels.length ? ` (${levels.join(', ')})` : ''}.`
}

export function supportMessage(
  kind: SupportKind,
  contactName: string,
  checkIn: CheckIn | null = null,
): string {
  const hi = `Hi ${firstName(contactName)},`
  if (kind === 'support') {
    return [
      hi,
      'I need support right now.',
      summarizeCheckIn(checkIn),
      "Could you pray for me, reach out, or just let me know you're there?",
    ]
      .filter(Boolean)
      .join(' ')
  }
  return `${hi} could you check in on me when you get a chance? No details needed — just your presence, a prayer, or a simple "I'm here."`
}

/** Keeps a leading + and digits only. */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '')
}

const isApple = () =>
  platform === 'ios' || (platform === 'web' && /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent))

/** sms: link with a pre-filled body. iOS expects `&body=`, Android and others `?body=`. */
export function smsUrl(phone: string, body: string, apple = isApple()): string {
  return `sms:${normalizePhone(phone)}${apple ? '&' : '?'}body=${encodeURIComponent(body)}`
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** How we can reach this contact, preferring a text. */
export function channelFor(contact: Pick<AccountabilityContact, 'phone' | 'email'>): Channel | null {
  if (normalizePhone(contact.phone).replace('+', '').length >= 3) return 'text'
  if (contact.email.trim()) return 'email'
  return null
}

/** Opens Messages / Mail / Phone. Tests can observe calls via `window.__ampOpenExternal`. */
export function openExternal(url: string) {
  const hook = (window as Window & { __ampOpenExternal?: (url: string) => void }).__ampOpenExternal
  if (hook) return hook(url)
  window.location.href = url
}

/** Opens a ready-to-send message to the contact. Returns the channel used, or null if unreachable. */
export function reachOut(
  contact: AccountabilityContact,
  kind: SupportKind,
  checkIn: CheckIn | null = null,
): Channel | null {
  const channel = channelFor(contact)
  const body = supportMessage(kind, contact.name, checkIn)
  if (channel === 'text') openExternal(smsUrl(contact.phone, body))
  else if (channel === 'email')
    openExternal(
      mailtoUrl(contact.email, kind === 'support' ? 'I need support' : 'Could you check in on me?', body),
    )
  return channel
}
