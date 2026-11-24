import { describe, expect, it } from 'vitest'
import { meetingWhen, timeAgo } from '@/lib/notifications'

describe('notification wording', () => {
  const now = new Date('2026-11-24T15:00:00')

  it('says when a meeting is', () => {
    expect(meetingWhen(new Date('2026-11-24T19:00:00').toISOString(), now)).toBe('Starts today at 7:00 PM')
    expect(meetingWhen(new Date('2026-11-25T09:30:00').toISOString(), now)).toBe('Starts tomorrow at 9:30 AM')
    expect(meetingWhen(new Date('2026-12-01T19:00:00').toISOString(), now)).toBe(
      'Starts Tue, Dec 1 at 7:00 PM',
    )
    expect(meetingWhen(new Date('2026-11-24T14:00:00').toISOString(), now)).toBe('Started today at 2:00 PM')
    expect(meetingWhen(new Date('2026-11-20T19:00:00').toISOString(), now)).toBe(
      'Started Fri, Nov 20 at 7:00 PM',
    )
  })

  it('says how long ago', () => {
    const t = now.getTime()
    const at = (ms: number) => new Date(t - ms).toISOString()
    expect(timeAgo(at(20_000), t)).toBe('Just now')
    expect(timeAgo(at(60_000), t)).toBe('1 minute ago')
    expect(timeAgo(at(45 * 60_000), t)).toBe('45 minutes ago')
    expect(timeAgo(at(3 * 3_600_000), t)).toBe('3 hours ago')
    expect(timeAgo(at(30 * 3_600_000), t)).toBe('Yesterday')
    expect(timeAgo(at(4 * 86_400_000), t)).toBe('4 days ago')
    expect(timeAgo(at(20 * 86_400_000), t)).toBe('Nov 4')
  })
})
