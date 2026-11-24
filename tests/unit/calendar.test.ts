import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/data/types'
import {
  expandOccurrences,
  icsFor,
  locationUrl,
  monthGrid,
  remindersLabel,
  repeatLabel,
  timeRange,
} from '@/lib/calendar'

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e1',
  rooms: ['men-recovery'],
  title: 'Tuesday Night Group',
  description: '',
  location: '',
  starts_local: '2026-12-01T19:00:00',
  timezone: 'America/Chicago',
  duration_minutes: 90,
  repeat: 'none',
  repeat_until: null,
  reminders: [1440, 60],
  created_by: null,
  created_at: '',
  updated_at: '',
  ...over,
})

describe('calendar wording', () => {
  it('describes reminders and repeats', () => {
    expect(remindersLabel([60, 1440])).toBe('1 day before, 1 hour before')
    expect(remindersLabel([0])).toBe('At start time')
    expect(remindersLabel([])).toBe('No reminders')
    expect(repeatLabel('weekly', '2026-12-01T19:00:00')).toBe('Every week on Tuesday')
    expect(repeatLabel('biweekly', '2026-12-01T19:00:00', '2027-03-01')).toBe(
      'Every 2 weeks on Tuesday, until Mar 1, 2027',
    )
    expect(repeatLabel('monthly', '2027-01-31T10:00:00')).toBe('Every month on day 31')
    expect(repeatLabel('none', '2026-12-01T19:00:00', '2027-01-01')).toBe('Does not repeat')
  })

  it('shows a time range', () => {
    const start = new Date(2026, 11, 1, 19, 0)
    const end = new Date(2026, 11, 1, 20, 30)
    expect(timeRange({ starts_at: start.toISOString(), ends_at: end.toISOString() })).toBe('7:00 – 8:30 PM')
  })

  it('links only https locations', () => {
    expect(locationUrl('https://zoom.us/j/123')).toBe('https://zoom.us/j/123')
    expect(locationUrl('Fellowship Hall, Room 2')).toBeNull()
    expect(locationUrl('javascript:alert(1)')).toBeNull()
  })

  it('lays out a month as 6 weeks starting on Sunday', () => {
    const days = monthGrid(new Date(2026, 11, 15))
    expect(days).toHaveLength(42)
    expect(days[0]!.getDay()).toBe(0)
  })
})

describe('expanding repeats (on-device)', () => {
  it('repeats weekly within the range', () => {
    const list = expandOccurrences([event({ repeat: 'weekly' })], new Date(2026, 11, 1), new Date(2026, 11, 29))
    expect(list.map((o) => o.starts_local)).toEqual([
      '2026-12-01T19:00:00',
      '2026-12-08T19:00:00',
      '2026-12-15T19:00:00',
      '2026-12-22T19:00:00',
    ])
    expect(new Date(list[0]!.ends_at).getTime() - new Date(list[0]!.starts_at).getTime()).toBe(90 * 60_000)
  })

  it('keeps monthly meetings on the last day of short months, and stops at "until"', () => {
    const list = expandOccurrences(
      [event({ starts_local: '2027-01-31T10:00:00', repeat: 'monthly', repeat_until: '2027-04-30' })],
      new Date(2027, 0, 1),
      new Date(2027, 6, 1),
    )
    expect(list.map((o) => o.starts_local.slice(0, 10))).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'])
  })

  it('includes a one-time event once', () => {
    expect(expandOccurrences([event({})], new Date(2026, 10, 1), new Date(2027, 0, 1))).toHaveLength(1)
    expect(expandOccurrences([event({})], new Date(2027, 0, 1), new Date(2027, 1, 1))).toHaveLength(0)
  })

  it('makes an .ics file for adding to a phone calendar', () => {
    const [o] = expandOccurrences([event({ location: 'Room 2, Main St' })], new Date(2026, 11, 1), new Date(2026, 11, 2))
    const ics = icsFor(o!)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:Tuesday Night Group')
    expect(ics).toContain('LOCATION:Room 2\\, Main St')
  })
})
