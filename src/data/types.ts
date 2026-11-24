/**
 * Row types. These mirror supabase/migrations/*_init.sql exactly; the Base44
 * entity each one replaces is noted on the type.
 */

export type Track = 'men' | 'spouse'

/** Asked during account setup. Null on profiles made before the question existed. */
export type Gender = 'man' | 'woman'

export type NameDisplay = 'first_last_initial' | 'first' | 'initials' | 'full' | 'nickname'

/** Base44: UserProfile */
export interface Profile {
  id: string
  user_id: string
  track: Track
  gender: Gender | null
  reason: string
  primary_needs: string[]
  /** First name. Private greeting ("Good morning, David") and the start of the group name. */
  display_name: string
  last_name: string
  /** How the name shows to others in the group. See src/lib/names.ts. */
  name_display: NameDisplay
  nickname: string
  /** First day (yyyy-MM-dd) of the current stretch of freedom; null until started. */
  freedom_start: string | null
  /** Longest stretch so far, in days. */
  freedom_best_days: number
  /** Hide the freedom counter on Home. */
  freedom_hidden: boolean
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
  /** Every feeling selected in "How are you today?" */
  emotions: string[]
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

// ---------------------------------------------------------------------------
// Group chat (supabase/migrations/*_group_chat.sql)
// ---------------------------------------------------------------------------

export type GroupRoomId = 'men-recovery' | 'women-recovery' | 'men-betrayed' | 'women-betrayed'

export interface GroupMember {
  user_id: string
  room: GroupRoomId
  /** The name the group sees, derived on the server from the profile. */
  display_name: string
  role: 'member' | 'moderator'
  /** pending: waiting for a leader; declined: a leader said no (they can ask again). */
  status: 'pending' | 'active' | 'declined'
  requested_at: string | null
  joined_at: string
  agreed_at: string
  last_read_at: string
  left_at: string | null
}

export interface GroupMessage {
  id: string
  room: GroupRoomId
  user_id: string
  /** "system" rows are "joined the group" style notices. */
  kind: 'text' | 'system'
  body: string
  reply_to: string | null
  liked_by: string[]
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export interface GroupReport {
  id: string
  message_id: string
  room: GroupRoomId
  author_id: string
  body_snapshot: string
  reporter: string
  reason: string
  created_at: string
  resolved_at: string | null
}

/** A row on the Leaders page (public.leader_people). */
export interface LeaderPerson {
  user_id: string
  /** The name they chose to show their group. Leaders never see emails or real names. */
  shown_name: string
  gender: Gender | null
  track: Track | null
  /** The group their profile belongs in. */
  room: GroupRoomId | null
  member_status: 'none' | 'pending' | 'member' | 'left' | 'declined' | 'removed'
  requested_at: string | null
  joined_at: string | null
  is_leader: boolean
  created_at: string
}
