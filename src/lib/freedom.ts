import { differenceInCalendarDays, parseISO } from 'date-fns'

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

/** The message posted to the group when sharing a milestone. */
export function milestoneShareText(days: number): string {
  return `🎉 ${durationLabel(days)} of freedom today. Thank you for walking with me.`
}
