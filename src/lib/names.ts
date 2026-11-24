import type { NameDisplay } from '@/data/types'

/**
 * How a person's name shows to others in their group. Mirrors
 * public.public_name() in supabase/migrations/*_group_chat.sql — keep the two
 * in step (tests/unit/names.test.ts and supabase/tests/chat.sql cover both).
 */
export interface NameParts {
  first: string
  last: string
  style: NameDisplay
  nickname: string
}

const initial = (s: string) => (Array.from(s.trim())[0] ?? '').toUpperCase()

/** The public name, or '' when the chosen style has nothing to show yet. */
export function publicName({ first, last, style, nickname }: NameParts): string {
  const f = first.trim()
  const l = last.trim()
  switch (style) {
    case 'nickname':
      return nickname.trim()
    case 'first':
      return f
    case 'full':
      return `${f} ${l}`.trim()
    case 'initials':
      return (f ? `${initial(f)}.` : '') + (l ? `${initial(l)}.` : '')
    default:
      return `${f}${l ? ` ${initial(l)}.` : ''}`.trim()
  }
}

export const NAME_STYLES: { value: NameDisplay; label: string; hint: string }[] = [
  { value: 'first_last_initial', label: 'First name and last initial', hint: 'Recommended' },
  { value: 'first', label: 'First name only', hint: '' },
  { value: 'initials', label: 'Initials only', hint: 'Most private' },
  { value: 'full', label: 'Full name', hint: '' },
  { value: 'nickname', label: 'A nickname', hint: '' },
]

export const MAX_NICKNAME = 30

/** One or two letters for an avatar circle. */
export function avatarInitials(name: string): string {
  const words = name.replace(/\./g, ' ').trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1)
  return letters.map(initial).join('') || '?'
}

const AVATAR_HUES = [12, 32, 145, 175, 200, 225, 262, 295, 335]

/** A steady color per person, so the same member always looks the same. */
export function avatarColor(userId: string): string {
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const hue = AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length]!
  return `hsl(${hue} 42% 42%)`
}
