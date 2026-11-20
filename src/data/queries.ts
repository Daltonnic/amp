import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { format } from 'date-fns'
import { lastNDays, localDate } from '@/lib/dates'
import { backend } from './index'
import type {
  AccountabilityContact,
  AccountabilityContactInput,
  CheckInInput,
  GroundingType,
  JournalEntry,
  JournalEntryInput,
  Patch,
  Profile,
  ProfileInput,
  Track,
  TriggerLog,
  TriggerLogInput,
} from './types'

export const keys = {
  profile: ['profile'] as const,
  todayCheckIn: (date: string) => ['checkIns', 'day', date] as const,
  weekCheckIns: (since: string) => ['checkIns', 'since', since] as const,
  checkIns: ['checkIns'] as const,
  journal: ['journal'] as const,
  triggerLogs: ['triggerLogs'] as const,
  contacts: ['contacts'] as const,
  library: ['library'] as const,
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async () => (await backend.table('profiles').list({ limit: 1 }))[0] ?? null,
  })
}

/** The user's track; defaults to "men" until the profile has loaded (as the original app did). */
export function useTrack(): Track {
  return useProfile().data?.track ?? 'men'
}

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfileInput) => backend.table('profiles').insert(input),
    onSuccess: (profile) => qc.setQueryData(keys.profile, profile),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Patch<Profile> }) =>
      backend.table('profiles').update(id, patch),
    onSuccess: (profile) => qc.setQueryData(keys.profile, profile),
  })
}

export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => backend.table('profiles').remove(id),
    onSuccess: () => qc.setQueryData(keys.profile, null),
  })
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export function useTodayCheckIn() {
  const today = localDate()
  return useQuery({
    queryKey: keys.todayCheckIn(today),
    queryFn: async () =>
      (
        await backend.table('check_ins').list({
          eq: { date: today },
          orderBy: 'created_at',
          ascending: false,
          limit: 1,
        })
      )[0] ?? null,
  })
}

export interface WeekDay {
  day: string
  date: string
  intensity: number | null
  temptation: number | null
  stress: number | null
  emotion: string | null
  hasData: boolean
}

export function useWeekCheckIns() {
  const days = lastNDays(7)
  const since = localDate(days[0])
  return useQuery({
    queryKey: keys.weekCheckIns(since),
    queryFn: () =>
      backend.table('check_ins').list({
        gte: { date: since },
        orderBy: 'created_at',
        ascending: false,
        limit: 60,
      }),
    select: (rows): WeekDay[] =>
      days.map((d) => {
        const date = localDate(d)
        // Rows are newest-first, so this is the latest check-in that day.
        const row = rows.find((r) => r.date === date)
        return {
          day: format(d, 'EEE'),
          date,
          intensity: row?.intensity ?? null,
          temptation: row?.temptation_level ?? null,
          stress: row?.stress_level ?? null,
          emotion: row ? row.emotional_state || row.custom_emotion || null : null,
          hasData: Boolean(row),
        }
      }),
  })
}

export function useCreateCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CheckInInput) => backend.table('check_ins').insert(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.checkIns }),
  })
}

// ---------------------------------------------------------------------------
// Generic optimistic list helpers (journal, trigger logs, contacts)
// ---------------------------------------------------------------------------

function useOptimisticCreate<Row extends { id: string }, Input>(
  queryKey: QueryKey,
  insert: (input: Input) => Promise<Row>,
  position: 'start' | 'end',
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: insert,
    onMutate: async (input: Input) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Row[]>(queryKey)
      const now = new Date().toISOString()
      const temp = { ...input, id: `temp-${Date.now()}`, created_at: now, updated_at: now } as unknown as Row
      qc.setQueryData<Row[]>(queryKey, (rows = []) =>
        position === 'start' ? [temp, ...rows] : [...rows, temp],
      )
      return { previous }
    },
    onError: (_err, _input, context) => qc.setQueryData(queryKey, context?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })
}

function useOptimisticDelete<Row extends { id: string }>(
  queryKey: QueryKey,
  remove: (id: string) => Promise<void>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: remove,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<Row[]>(queryKey)
      qc.setQueryData<Row[]>(queryKey, (rows = []) => rows.filter((r) => r.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => qc.setQueryData(queryKey, context?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  })
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export function useJournal() {
  return useQuery({
    queryKey: keys.journal,
    queryFn: () =>
      backend.table('journal_entries').list({ orderBy: 'created_at', ascending: false, limit: 200 }),
  })
}

export const useCreateJournalEntry = () =>
  useOptimisticCreate<JournalEntry, JournalEntryInput>(
    keys.journal,
    (input) => backend.table('journal_entries').insert(input),
    'start',
  )

export function useUpdateJournalEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Patch<JournalEntry> }) =>
      backend.table('journal_entries').update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.journal }),
  })
}

export const useDeleteJournalEntry = () =>
  useOptimisticDelete<JournalEntry>(keys.journal, (id) => backend.table('journal_entries').remove(id))

// ---------------------------------------------------------------------------
// Trigger logs
// ---------------------------------------------------------------------------

export function useTriggerLogs() {
  return useQuery({
    queryKey: keys.triggerLogs,
    queryFn: () =>
      backend.table('trigger_logs').list({ orderBy: 'created_at', ascending: false, limit: 100 }),
  })
}

export function useCreateTriggerLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TriggerLogInput) => backend.table('trigger_logs').insert(input),
    onSuccess: (log) => qc.setQueryData<TriggerLog[]>(keys.triggerLogs, (rows = []) => [log, ...rows]),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.triggerLogs }),
  })
}

export const useDeleteTriggerLog = () =>
  useOptimisticDelete<TriggerLog>(keys.triggerLogs, (id) => backend.table('trigger_logs').remove(id))

// ---------------------------------------------------------------------------
// Grounding sessions
// ---------------------------------------------------------------------------

export function useLogGroundingSession() {
  return useMutation({
    mutationFn: (type: GroundingType) => backend.table('grounding_sessions').insert({ type }),
  })
}

// ---------------------------------------------------------------------------
// Accountability contacts
// ---------------------------------------------------------------------------

export function useContacts() {
  return useQuery({
    queryKey: keys.contacts,
    queryFn: () => backend.table('accountability_contacts').list({ orderBy: 'created_at', ascending: true }),
  })
}

export const useCreateContact = () =>
  useOptimisticCreate<AccountabilityContact, AccountabilityContactInput>(
    keys.contacts,
    (input) => backend.table('accountability_contacts').insert(input),
    'end',
  )

export const useDeleteContact = () =>
  useOptimisticDelete<AccountabilityContact>(keys.contacts, (id) =>
    backend.table('accountability_contacts').remove(id),
  )

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function useLibrary() {
  return useQuery({
    queryKey: keys.library,
    queryFn: () =>
      backend.table('library_articles').list({ orderBy: 'created_at', ascending: false, limit: 500 }),
    staleTime: 10 * 60_000,
  })
}
