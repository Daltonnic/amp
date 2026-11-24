import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { CalendarEvent, CalendarOccurrence, Repeat } from '@/data/types'

/** Reminder choices leaders pick from (minutes before the start). Mirrors the DB check. */
export const REMINDER_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'At start time' },
  { minutes: 5, label: '5 minutes before' },
  { minutes: 15, label: '15 minutes before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 2880, label: '2 days before' },
  { minutes: 10080, label: '1 week before' },
]

/** What a new event starts with: a day ahead to plan, an hour ahead to remember. */
export const SUGGESTED_REMINDERS = [1440, 60]

export const DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 45, label: '45 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1½ hours' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: '4 hours' },
]

/** "1 day before, 1 hour before", "At start time". */
export function remindersLabel(reminders: number[]): string {
  if (reminders.length === 0) return 'No reminders'
  const text = [...reminders]
    .sort((a, b) => b - a)
    .map((m) => (REMINDER_PRESETS.find((p) => p.minutes === m)?.label ?? `${m} minutes before`).toLowerCase())
    .join(', ')
  return text[0]!.toUpperCase() + text.slice(1)
}

/** "Every week on Tuesday", "Every month on day 31", "Does not repeat". */
export function repeatLabel(repeat: Repeat, startsLocal: string, until?: string | null): string {
  const start = parseISO(startsLocal)
  const base = {
    none: 'Does not repeat',
    daily: 'Every day',
    weekly: `Every week on ${format(start, 'EEEE')}`,
    biweekly: `Every 2 weeks on ${format(start, 'EEEE')}`,
    monthly: `Every month on day ${format(start, 'd')}`,
  }[repeat]
  return repeat !== 'none' && until ? `${base}, until ${format(parseISO(until), 'MMM d, yyyy')}` : base
}

/** The device's time zone, e.g. "America/Chicago". */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/** "Today", "Tomorrow", "Tue, Dec 1". */
export function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'EEE, MMM d')
}

/** "7:00 – 8:30 PM" in the viewer's time zone. */
export function timeRange(o: Pick<CalendarOccurrence, 'starts_at' | 'ends_at'>): string {
  const start = new Date(o.starts_at)
  const end = new Date(o.ends_at)
  const sameHalf = format(start, 'a') === format(end, 'a') && isSameDay(start, end)
  return `${format(start, sameHalf ? 'h:mm' : 'h:mm a')} – ${format(end, 'h:mm a')}`
}

/** The 6×7 days shown for a month (Sunday first). */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month))
  const end = endOfWeek(endOfMonth(month))
  const days: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  while (days.length < 42) days.push(addDays(days[days.length - 1]!, 1))
  return days
}

/** A link if the location is a web address (leaders paste meeting links). */
export function locationUrl(location: string): string | null {
  const text = location.trim()
  return /^https:\/\/\S+$/i.test(text) ? text : null
}

/**
 * Expands events into occurrences between `from` and `to`. Used on-device
 * (development and tests), where every event is in the device's time zone.
 * On the server, public.calendar_occurrences does this with full time-zone
 * support.
 */
export function expandOccurrences(events: CalendarEvent[], from: Date, to: Date): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = []
  for (const e of events) {
    const first = parseISO(e.starts_local)
    const until = e.repeat_until ? addDays(parseISO(e.repeat_until), 1) : null
    const step = (n: number) =>
      e.repeat === 'daily'
        ? addDays(first, n)
        : e.repeat === 'weekly'
          ? addWeeks(first, n)
          : e.repeat === 'biweekly'
            ? addWeeks(first, 2 * n)
            : e.repeat === 'monthly'
              ? addMonths(first, n)
              : first
    const span = Math.max(0, differenceInCalendarDays(to, first))
    const max = e.repeat === 'none' ? 0 : Math.min(span + 1, 5000)
    for (let n = 0; n <= max; n++) {
      const start = step(n)
      if (until && start >= until) break
      if (start >= to) break
      const end = new Date(start.getTime() + e.duration_minutes * 60_000)
      if (end <= from) continue
      out.push({
        event_id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        rooms: e.rooms,
        repeat: e.repeat,
        repeat_until: e.repeat_until,
        timezone: e.timezone,
        duration_minutes: e.duration_minutes,
        reminders: e.reminders,
        starts_local: format(start, "yyyy-MM-dd'T'HH:mm:ss"),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      })
      if (e.repeat === 'none') break
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}

const icsDate = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
const icsText = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, (c) => `\\${c}`)

/** An .ics file for one occurrence, so people can add it to their phone's calendar. */
export function icsFor(o: CalendarOccurrence): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AMP The Journey//Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${o.event_id}-${icsDate(new Date(o.starts_at))}@amp`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(new Date(o.starts_at))}`,
    `DTEND:${icsDate(new Date(o.ends_at))}`,
    `SUMMARY:${icsText(o.title)}`,
    o.location ? `LOCATION:${icsText(o.location)}` : '',
    o.description ? `DESCRIPTION:${icsText(o.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}
