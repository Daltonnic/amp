import type { SupabaseClient } from '@supabase/supabase-js'
import { roomFor } from '@/content/group'
import { expandOccurrences } from '@/lib/calendar'
import { isCloudConfigured } from '@/lib/config'
import { getSupabase } from '@/lib/supabase'
import { DEVICE_USER_ID } from './deviceBackend'
import type { CalendarEvent, CalendarEventInput, CalendarOccurrence, Profile } from './types'

/**
 * The calendar. Leaders add, edit and delete events; everyone reads the
 * events of their own section (leaders read all). Enforced by Row Level
 * Security in supabase/migrations/*_calendar.sql.
 */
export interface CalendarApi {
  /** Every occurrence (repeats expanded) that overlaps [from, to). */
  occurrences(from: Date, to: Date): Promise<CalendarOccurrence[]>
  event(id: string): Promise<CalendarEvent | null>
  create(input: CalendarEventInput): Promise<CalendarEvent>
  update(id: string, input: CalendarEventInput): Promise<CalendarEvent>
  remove(id: string): Promise<void>
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export function createSupabaseCalendar(sb: SupabaseClient): CalendarApi {
  return {
    async occurrences(from, to) {
      const { data, error } = await sb.rpc('calendar_occurrences', {
        range_start: from.toISOString(),
        range_end: to.toISOString(),
      })
      fail(error)
      return data as CalendarOccurrence[]
    },
    async event(id) {
      const { data, error } = await sb.from('calendar_events').select('*').eq('id', id).maybeSingle()
      fail(error)
      return data as CalendarEvent | null
    },
    async create(input) {
      const { data, error } = await sb.from('calendar_events').insert(input).select().single()
      if (error?.code === '42501') throw new Error('Only leaders can add events.')
      fail(error)
      return data as CalendarEvent
    },
    async update(id, input) {
      const { data, error } = await sb.from('calendar_events').update(input).eq('id', id).select().single()
      fail(error)
      return data as CalendarEvent
    },
    async remove(id) {
      const { error } = await sb.from('calendar_events').delete().eq('id', id)
      fail(error)
    },
  }
}

// On-device (development, previews and automated tests).
const KEY = 'amp.device.calendar_events'

function load(): CalendarEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CalendarEvent[]
  } catch {
    return []
  }
}
const save = (rows: CalendarEvent[]) => localStorage.setItem(KEY, JSON.stringify(rows))

function deviceVisible(): (e: CalendarEvent) => boolean {
  let leaders: string[] = [DEVICE_USER_ID]
  try {
    const raw = localStorage.getItem('amp.device.leaders')
    if (raw !== null) leaders = JSON.parse(raw) as string[]
  } catch {
    /* default */
  }
  if (leaders.includes(DEVICE_USER_ID)) return () => true
  let profile: Profile | undefined
  try {
    profile = (JSON.parse(localStorage.getItem('amp.device.profiles') ?? '[]') as Profile[]).find(
      (p) => p.user_id === DEVICE_USER_ID,
    )
  } catch {
    /* none */
  }
  const room = profile ? roomFor(profile.track, profile.gender) : null
  return (e) => Boolean(room && e.rooms.includes(room))
}

export function createDeviceCalendar(): CalendarApi {
  return {
    async occurrences(from, to) {
      return expandOccurrences(load().filter(deviceVisible()), from, to)
    },
    async event(id) {
      return load().find((e) => e.id === id) ?? null
    },
    async create(input) {
      const now = new Date().toISOString()
      const row: CalendarEvent = {
        ...input,
        id: crypto.randomUUID(),
        created_by: DEVICE_USER_ID,
        created_at: now,
        updated_at: now,
      }
      save([...load(), row])
      return row
    },
    async update(id, input) {
      const rows = load()
      const i = rows.findIndex((e) => e.id === id)
      if (i < 0) throw new Error('That event no longer exists.')
      rows[i] = { ...rows[i]!, ...input, updated_at: new Date().toISOString() }
      save(rows)
      return rows[i]!
    },
    async remove(id) {
      save(load().filter((e) => e.id !== id))
    },
  }
}

export const calendar: CalendarApi = isCloudConfigured
  ? createSupabaseCalendar(getSupabase())
  : createDeviceCalendar()
