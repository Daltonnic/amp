import { describe, expect, it } from 'vitest'
import type { GroupMessage } from '@/data/types'
import { buildThread, dayLabel, mergeLatest } from '@/lib/groupThread'

const msg = (id: string, user: string, at: string, kind: GroupMessage['kind'] = 'text'): GroupMessage => ({
  id,
  room: 'men-recovery',
  user_id: user,
  kind,
  body: kind === 'system' ? 'joined the group' : `message ${id}`,
  reply_to: null,
  liked_by: [],
  created_at: at,
  deleted_at: null,
  deleted_by: null,
})

describe('group thread', () => {
  const now = new Date('2026-11-24T18:00:00')

  it('groups back-to-back messages from the same person', () => {
    const items = buildThread(
      [
        msg('1', 'a', '2026-11-24T09:00:00'),
        msg('2', 'a', '2026-11-24T09:02:00'),
        msg('3', 'b', '2026-11-24T09:03:00'),
        msg('4', 'a', '2026-11-24T09:04:00'),
      ],
      now,
    )
    const shape = items.map((i) =>
      i.type === 'message' ? `${i.message.id}:${i.first ? 'F' : ''}${i.last ? 'L' : ''}` : i.type,
    )
    expect(shape).toEqual(['day', '1:F', '2:L', '3:FL', '4:FL'])
  })

  it('starts a new run after a long pause or a notice', () => {
    const items = buildThread(
      [
        msg('1', 'a', '2026-11-24T09:00:00'),
        msg('2', 'a', '2026-11-24T09:30:00'),
        msg('j', 'c', '2026-11-24T09:31:00', 'system'),
        msg('3', 'a', '2026-11-24T09:32:00'),
      ],
      now,
    )
    const firsts = items.filter((i) => i.type === 'message' && i.first).map((i) => i.key)
    expect(firsts).toEqual(['1', '2', '3'])
    expect(items.some((i) => i.type === 'system')).toBe(true)
  })

  it('adds a divider for each day', () => {
    const items = buildThread(
      [msg('1', 'a', '2026-11-23T22:00:00'), msg('2', 'a', '2026-11-24T08:00:00')],
      now,
    )
    expect(items.filter((i) => i.type === 'day').map((i) => (i.type === 'day' ? i.label : ''))).toEqual([
      'Yesterday',
      'Today',
    ])
  })

  it('labels older days by weekday, and other years with the year', () => {
    expect(dayLabel(new Date('2026-11-20T10:00:00'), now)).toBe('Friday, Nov 20')
    expect(dayLabel(new Date('2025-12-31T10:00:00'), now)).toBe('Dec 31, 2025')
  })
})

describe('catching up on missed messages', () => {
  const at = (minute: number) => `2026-11-24T09:${String(minute).padStart(2, '0')}:00Z`
  // Pages are newest first, like the thread's loaded pages.
  const loaded = [[msg('3', 'a', at(3)), msg('2', 'b', at(2))], [msg('1', 'a', at(1))]]

  it('adds messages sent while away, newest first', () => {
    const latest = [msg('5', 'b', at(5)), msg('4', 'a', at(4)), msg('3', 'a', at(3))]
    const merged = mergeLatest(loaded, latest, 40)!
    expect(merged.pages[0]!.map((m) => m.id)).toEqual(['5', '4', '3', '2'])
    expect(merged.pages[1]!.map((m) => m.id)).toEqual(['1'])
    expect(merged.added.map((m) => m.id)).toEqual(['5', '4'])
  })

  it('updates likes and deletes made while away', () => {
    const liked = { ...msg('3', 'a', at(3)), liked_by: ['b'] }
    const deleted = { ...msg('2', 'b', at(2)), deleted_at: at(6) }
    const merged = mergeLatest(loaded, [liked, deleted], 40)!
    expect(merged.added).toEqual([])
    expect(merged.pages[0]![0]!.liked_by).toEqual(['b'])
    expect(merged.pages[0]![1]!.deleted_at).toBe(at(6))
  })

  it('changes nothing when nothing happened', () => {
    const merged = mergeLatest(loaded, [], 40)!
    expect(merged.pages).toBe(loaded)
    expect(merged.added).toEqual([])
  })

  it('asks for a reload when a full page arrived and some may be missing', () => {
    const flood = [msg('9', 'b', at(9)), msg('8', 'b', at(8))]
    expect(mergeLatest(loaded, flood, 2)).toBeNull()
  })

  it('fills an empty thread', () => {
    const merged = mergeLatest([[]], [msg('1', 'a', at(1))], 40)!
    expect(merged.pages[0]!.map((m) => m.id)).toEqual(['1'])
  })
})
