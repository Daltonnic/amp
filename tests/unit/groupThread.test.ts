import { describe, expect, it } from 'vitest'
import type { GroupMessage } from '@/data/types'
import { buildThread, dayLabel } from '@/lib/groupThread'

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
