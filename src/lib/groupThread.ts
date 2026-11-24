import { differenceInMinutes, format, isSameDay, isSameYear, isToday, isYesterday } from 'date-fns'
import type { GroupMessage } from '@/data/types'

export type ThreadItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'system'; key: string; message: GroupMessage }
  | { type: 'message'; key: string; message: GroupMessage; first: boolean; last: boolean }

/** Messages from one person this close together share one name and avatar. */
const GROUP_MINUTES = 5

export function dayLabel(date: Date, now = new Date()): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return isSameYear(date, now) ? format(date, 'EEEE, MMM d') : format(date, 'MMM d, yyyy')
}

/**
 * Turns oldest-first messages into what the thread shows: day dividers,
 * "joined the group" notices, and runs of messages from the same person.
 */
export function buildThread(messages: GroupMessage[], now = new Date()): ThreadItem[] {
  const items: ThreadItem[] = []
  let prev: GroupMessage | null = null
  for (const message of messages) {
    const at = new Date(message.created_at)
    if (!prev || !isSameDay(new Date(prev.created_at), at)) {
      items.push({
        type: 'day',
        key: `day-${message.created_at.slice(0, 10)}-${message.id}`,
        label: dayLabel(at, now),
      })
      prev = null
    }
    if (message.kind === 'system') {
      items.push({ type: 'system', key: message.id, message })
      prev = null
      continue
    }
    const continues =
      prev !== null &&
      prev.user_id === message.user_id &&
      differenceInMinutes(at, new Date(prev.created_at)) < GROUP_MINUTES
    const last = items[items.length - 1]
    if (continues && last?.type === 'message') last.last = false
    items.push({ type: 'message', key: message.id, message, first: !continues, last: true })
    prev = message
  }
  return items
}

/**
 * Folds the newest messages from the server (newest first, at most
 * `pageSize`) into the pages already on screen, so anything missed while the
 * live connection was down appears without reloading every page. Changed
 * messages (likes, deletes) are replaced in place.
 *
 * Returns null when more than a page arrived while away, so some may be
 * missing in between; the caller should reload instead.
 */
export function mergeLatest(
  pages: GroupMessage[][],
  latest: GroupMessage[],
  pageSize: number,
): { pages: GroupMessage[][]; added: GroupMessage[] } | null {
  const fresh = new Map(latest.map((m) => [m.id, m]))
  const loaded = new Set(pages.flat().map((m) => m.id))
  const added = latest.filter((m) => !loaded.has(m.id))
  if (loaded.size > 0 && latest.length >= pageSize && added.length === latest.length) return null
  if (added.length === 0 && !latest.some((m) => loaded.has(m.id))) return { pages, added }
  const next = pages.map((page) => page.map((m) => fresh.get(m.id) ?? m))
  if (added.length) {
    next[0] = [...added, ...(next[0] ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  }
  return { pages: next, added }
}
