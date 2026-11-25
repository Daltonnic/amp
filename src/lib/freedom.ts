import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Profile } from '@/data/types'

/**
 * The freedom counter: days since the current stretch of freedom began.
 * Milestones are celebrated; starting again is met with grace, not a red zero.
 */
export const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 120, 180, 270, 365]
const YEAR = 365

/** Whole days from `start` (yyyy-MM-dd, local) to today. 0 on the first day. */
export function daysOfFreedom(start: string, today = new Date()): number {
  return Math.max(0, differenceInCalendarDays(today, parseISO(start)))
}

export function isMilestone(days: number): boolean {
  return MILESTONES.includes(days) || (days > YEAR && days % YEAR === 0)
}

/** The next milestone after `days`. */
export function nextMilestone(days: number): number {
  return MILESTONES.find((m) => m > days) ?? (Math.floor(days / YEAR) + 1) * YEAR
}

/** The last milestone reached (0 before the first). */
export function previousMilestone(days: number): number {
  if (days >= YEAR) return Math.floor(days / YEAR) * YEAR
  return [...MILESTONES].reverse().find((m) => m <= days) ?? 0
}

/** "1 day", "30 days", "1 year", "2 years". */
export function durationLabel(days: number): string {
  if (days >= YEAR && days % YEAR === 0) {
    const years = days / YEAR
    return `${years} ${years === 1 ? 'year' : 'years'}`
  }
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** How far through the current stretch to the next milestone, 0–1. */
export function progressToNext(days: number): number {
  const prev = previousMilestone(days)
  const next = nextMilestone(days)
  return next === prev ? 1 : (days - prev) / (next - prev)
}

/**
 * The milestone to celebrate now, if any: the latest one reached in this
 * stretch that hasn't been celebrated yet. Someone who doesn't open AMP on
 * day 30 still gets the celebration when they next do (until day 60).
 */
export function milestoneToCelebrate(
  p: Pick<Profile, 'track' | 'freedom_start' | 'freedom_hidden' | 'freedom_celebrated'>,
  today = new Date(),
): number | null {
  if (p.track !== 'men' || p.freedom_hidden || !p.freedom_start) return null
  const reached = previousMilestone(daysOfFreedom(p.freedom_start, today))
  return reached > 0 && reached > (p.freedom_celebrated ?? 0) ? reached : null
}

/** Scripture for celebrations; each milestone always gets the same one. */
export const MILESTONE_VERSES = [
  { text: 'It is for freedom that Christ has set us free.', ref: 'Galatians 5:1' },
  { text: 'His mercies never come to an end; they are new every morning.', ref: 'Lamentations 3:22–23' },
  { text: 'He who began a good work in you will bring it to completion.', ref: 'Philippians 1:6' },
  { text: 'If anyone is in Christ, he is a new creation.', ref: '2 Corinthians 5:17' },
  { text: 'So if the Son sets you free, you will be free indeed.', ref: 'John 8:36' },
  { text: 'Let us not grow weary of doing good, for in due season we will reap.', ref: 'Galatians 6:9' },
] as const

export function milestoneVerse(days: number) {
  const i = MILESTONES.indexOf(days)
  return MILESTONE_VERSES[(i >= 0 ? i : Math.floor(days / YEAR)) % MILESTONE_VERSES.length]!
}
