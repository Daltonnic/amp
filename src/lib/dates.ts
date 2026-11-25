import { format, subDays } from 'date-fns'

/** The user's local calendar date as yyyy-MM-dd (never UTC). */
export function localDate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

/** The last `days` local dates, oldest first, ending today. */
export function lastNDays(days: number, today: Date = new Date()): Date[] {
  return Array.from({ length: days }, (_, i) => subDays(today, days - 1 - i))
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Picks a stable item for today from a list (rotates daily). */
export function dailyPick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length] as T
}

/** This device's time zone ("America/Chicago"), or null if the browser won't say. */
export function currentTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}
