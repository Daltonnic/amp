import { useState } from 'react'
import { addDays } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendar, occurrenceKey } from './calendar'
import type { CalendarEventInput, RsvpResponse, RsvpSummary } from './types'

export const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: Date, to: Date) => ['calendar', 'range', from.toISOString(), to.toISOString()] as const,
  event: (id: string) => ['calendar', 'event', id] as const,
  rsvps: (from: Date, to: Date) => ['calendar', 'rsvps', from.toISOString(), to.toISOString()] as const,
  people: (eventId: string, start: string) => ['calendar', 'rsvp-people', eventId, start] as const,
}

/** Occurrences overlapping [from, to). */
export function useOccurrences(from: Date, to: Date, enabled = true) {
  return useQuery({
    queryKey: calendarKeys.range(from, to),
    queryFn: () => calendar.occurrences(from, to),
    enabled,
    staleTime: 60_000,
  })
}

/** The next meeting in the person's section (within 30 days), for Home. */
export function useNextMeeting() {
  // Fixed when the screen opens, so the query key is stable across renders.
  const [now] = useState(() => new Date(Math.floor(Date.now() / 60_000) * 60_000))
  const q = useOccurrences(now, addDays(now, 30))
  const rsvps = useRsvpSummary(now, addDays(now, 30))
  const next = q.data?.find((o) => new Date(o.ends_at) > now) ?? null
  return {
    ...q,
    data: next,
    rsvp: next ? rsvps.data?.get(occurrenceKey(next.event_id, next.starts_at)) : undefined,
  }
}

export function useCalendarEvent(id: string | null) {
  return useQuery({
    queryKey: calendarKeys.event(id ?? ''),
    queryFn: () => calendar.event(id!),
    enabled: Boolean(id),
  })
}

export function useSaveEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: CalendarEventInput }) =>
      id ? calendar.update(id, input) : calendar.create(input),
    onSettled: () => void qc.invalidateQueries({ queryKey: calendarKeys.all }),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => calendar.remove(id),
    onSettled: () => void qc.invalidateQueries({ queryKey: calendarKeys.all }),
  })
}

/** RSVP counts and your answers for a range, keyed by occurrenceKey(). */
export function useRsvpSummary(from: Date, to: Date, enabled = true) {
  return useQuery({
    queryKey: calendarKeys.rsvps(from, to),
    queryFn: async () => {
      const rows = await calendar.rsvpSummary(from, to)
      return new Map(rows.map((r) => [occurrenceKey(r.event_id, r.occurrence_start), r]))
    },
    enabled,
    staleTime: 30_000,
  })
}

/** Answer Going / Can't make it (or clear it), updating counts right away. */
export function useRsvp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      eventId,
      start,
      response,
    }: {
      eventId: string
      start: string
      response: RsvpResponse | null
    }) => calendar.rsvp(eventId, start, response),
    onMutate: ({ eventId, start, response }) => {
      const key = occurrenceKey(eventId, start)
      const snapshots = qc.getQueriesData<Map<string, RsvpSummary>>({ queryKey: ['calendar', 'rsvps'] })
      for (const [queryKey, map] of snapshots) {
        if (!map) continue
        const next = new Map(map)
        const cur = next.get(key) ?? {
          event_id: eventId,
          occurrence_start: start,
          going: 0,
          not_going: 0,
          mine: null,
        }
        const going = cur.going - (cur.mine === 'yes' ? 1 : 0) + (response === 'yes' ? 1 : 0)
        const notGoing = cur.not_going - (cur.mine === 'no' ? 1 : 0) + (response === 'no' ? 1 : 0)
        next.set(key, { ...cur, going, not_going: notGoing, mine: response })
        qc.setQueryData(queryKey, next)
      }
      return { snapshots }
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: (_d, _e, { eventId, start }) => {
      void qc.invalidateQueries({ queryKey: ['calendar', 'rsvps'] })
      void qc.invalidateQueries({ queryKey: calendarKeys.people(eventId, start) })
    },
  })
}

/** Leaders: who answered for one date. */
export function useRsvpPeople(eventId: string | null, start: string | null, enabled: boolean) {
  return useQuery({
    queryKey: calendarKeys.people(eventId ?? '', start ?? ''),
    queryFn: () => calendar.rsvpPeople(eventId!, start!),
    enabled: Boolean(eventId && start) && enabled,
  })
}
