/**
 * Row types. These mirror supabase/migrations/*_init.sql exactly; the Base44
 * entity each one replaces is noted on the type.
 */

export type Track = 'men' | 'spouse'

/** Base44: UserProfile */
export interface Profile {
  id: string
  user_id: string
  track: Track
  reason: string
  primary_needs: string[]
  display_name: string
  daily_reminders: boolean
  /** "HH:MM" (Postgres returns "HH:MM:SS"; both are accepted). */
  reminder_time: string
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

/** Base44: CheckIn */
export interface CheckIn {
  id: string
  user_id: string
  track: Track
  /** Local calendar date, yyyy-MM-dd. */
  date: string
  emotional_state: string
  custom_emotion: string
  intensity: number | null
  temptation_level: number | null
  stress_level: number | null
  recent_triggers: string
  spiritual_condition: string
  honesty_check: string
  next_step: string
  body_awareness: string
  primary_fear: string
  current_need: string
  reflection: string
  created_at: string
}

/** Base44: JournalEntry */
export interface JournalEntry {
  id: string
  user_id: string
  track: Track | null
  title: string
  content: string
  category: string
  prompt_used: string
  created_at: string
  updated_at: string
}

export type TriggerType =
  'visual' | 'emotional' | 'relational' | 'situational' | 'spiritual' | 'physical' | 'digital' | 'other'

export type ResponsePattern =
  '' | 'healthy_coping' | 'avoidance' | 'acting_out' | 'isolation' | 'reaching_out' | 'grounding' | 'other'

/** Base44: TriggerLog */
export interface TriggerLog {
  id: string
  user_id: string
  emotional_state: string
  trigger_type: TriggerType
  intensity: number
  event_description: string
  thoughts: string
  physical_sensations: string
  response_pattern: ResponsePattern
  healthy_next_step: string
  created_at: string
}

export type GroundingType =
  | 'breathing'
  | 'body_grounding'
  | 'orienting'
  | 'prayer'
  | 'truth_reminder'
  | 'scripture'
  | 'reassurance'
  | 'guide'

/** Base44: GroundingSession */
export interface GroundingSession {
  id: string
  user_id: string
  type: GroundingType
  created_at: string
}

/** Base44: AccountabilityContact */
export interface AccountabilityContact {
  id: string
  user_id: string
  name: string
  email: string
  phone: string
  relationship: string
  created_at: string
}

export type LibraryCategory =
  | 'scripture_teaching'
  | 'recovery'
  | 'emotional_health'
  | 'spiritual_formation'
  | 'spouse_support'
  | 'identity'
  | 'accountability'

/** Base44: LibraryArticle */
export interface LibraryArticle {
  id: string
  title: string
  content: string
  category: LibraryCategory
  track: Track | 'both'
  scripture_reference: string
  read_time_minutes: number | null
  tags: string
  featured: boolean
  published: boolean
  created_at: string
  updated_at: string
}

/** Columns the database fills in; never sent on insert. */
type ServerManaged = 'id' | 'user_id' | 'created_at' | 'updated_at'

export type Insert<T> = Omit<T, Extract<keyof T, ServerManaged>>
export type Patch<T> = Partial<Insert<T>>

export type ProfileInput = Insert<Profile>
export type CheckInInput = Insert<CheckIn>
export type JournalEntryInput = Insert<JournalEntry>
export type TriggerLogInput = Insert<TriggerLog>
export type GroundingSessionInput = Insert<GroundingSession>
export type AccountabilityContactInput = Insert<AccountabilityContact>

/** Table name → row type. Keys are the Postgres table names. */
export interface Tables {
  profiles: Profile
  check_ins: CheckIn
  journal_entries: JournalEntry
  trigger_logs: TriggerLog
  grounding_sessions: GroundingSession
  accountability_contacts: AccountabilityContact
  library_articles: LibraryArticle
}

export type TableName = keyof Tables

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
