import { describe, expect, it } from 'vitest'
import {
  daysOfFreedom,
  durationLabel,
  isMilestone,
  milestoneToCelebrate,
  milestoneVerse,
  MILESTONES,
  nextMilestone,
  previousMilestone,
  progressToNext,
} from '@/lib/freedom'

describe('freedom counter', () => {
  const today = new Date('2026-11-25T09:00:00')

  it('counts whole local days, starting at 0 on the first day', () => {
    expect(daysOfFreedom('2026-11-25', today)).toBe(0)
    expect(daysOfFreedom('2026-11-24', today)).toBe(1)
    expect(daysOfFreedom('2026-10-26', today)).toBe(30)
    expect(daysOfFreedom('2026-12-01', today)).toBe(0) // a future date never goes negative
  })

  it('knows the milestones, including every year after the first', () => {
    expect([1, 7, 30, 90, 365, 730].every(isMilestone)).toBe(true)
    expect([0, 2, 31, 366, 400].some(isMilestone)).toBe(false)
    expect(nextMilestone(0)).toBe(1)
    expect(nextMilestone(30)).toBe(60)
    expect(nextMilestone(365)).toBe(730)
    expect(previousMilestone(45)).toBe(30)
    expect(previousMilestone(800)).toBe(730)
    expect(progressToNext(45)).toBeCloseTo(0.5)
  })

  it('reads naturally', () => {
    expect(durationLabel(1)).toBe('1 day')
    expect(durationLabel(30)).toBe('30 days')
    expect(durationLabel(365)).toBe('1 year')
    expect(durationLabel(730)).toBe('2 years')
  })

  it('celebrates each milestone once, even if the day itself was missed', () => {
    const p = {
      track: 'men' as const,
      freedom_start: '2026-10-22',
      freedom_hidden: false,
      freedom_celebrated: 0,
    }
    // Day 34: 30 was reached on Nov 21 and not celebrated yet.
    expect(milestoneToCelebrate(p, today)).toBe(30)
    expect(milestoneToCelebrate({ ...p, freedom_celebrated: 30 }, today)).toBeNull()
    // Celebrated 21 earlier; 30 is new.
    expect(milestoneToCelebrate({ ...p, freedom_celebrated: 21 }, today)).toBe(30)
    // Not on day 0, not for spouses, not when the counter is hidden or not started.
    expect(milestoneToCelebrate({ ...p, freedom_start: '2026-11-25' }, today)).toBeNull()
    expect(milestoneToCelebrate({ ...p, track: 'spouse' }, today)).toBeNull()
    expect(milestoneToCelebrate({ ...p, freedom_hidden: true }, today)).toBeNull()
    expect(milestoneToCelebrate({ ...p, freedom_start: null }, today)).toBeNull()
    // Years.
    expect(milestoneToCelebrate({ ...p, freedom_start: '2024-11-20' }, today)).toBe(730)
  })

  it('gives every milestone a verse', () => {
    for (const m of [...MILESTONES, 730, 1095]) expect(milestoneVerse(m).ref).toBeTruthy()
    expect(milestoneVerse(30)).toEqual(milestoneVerse(30))
  })
})
