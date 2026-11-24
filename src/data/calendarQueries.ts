import { useState } from 'react'
import { addDays } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendar } from './calendar'
import type { CalendarEventInput } from './types'

export const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: Date, to: Date) => ['calendar', 'range', from.toISOString(), to.toISOString()] as const,
  event: (id: string) => ['calendar', 'event', id] as const,
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
  return { ...q, data: q.data?.find((o) => new Date(o.ends_at) > now) ?? null }
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
