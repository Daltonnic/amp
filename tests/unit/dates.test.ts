import { describe, expect, it } from 'vitest'
import { dailyPick, greeting, lastNDays, localDate } from '@/lib/dates'

describe('dates', () => {
  it('uses the local calendar date, not UTC', () => {
    // 9:30pm local on Nov 20 — UTC may already be Nov 21; the check-in must stay on the 20th.
    const evening = new Date(2026, 10, 20, 21, 30)
    expect(localDate(evening)).toBe('2026-11-20')
  })

  it('lists the last 7 days ending today, oldest first', () => {
    const days = lastNDays(7, new Date(2026, 10, 20, 12))
    expect(days.map((d) => localDate(d))).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ])
  })

  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Good morning')
    expect(greeting(new Date(2026, 0, 1, 13))).toBe('Good afternoon')
    expect(greeting(new Date(2026, 0, 1, 19))).toBe('Good evening')
  })

  it('rotates daily picks', () => {
    expect(dailyPick(['a', 'b', 'c'], 4)).toBe('b')
  })
})
