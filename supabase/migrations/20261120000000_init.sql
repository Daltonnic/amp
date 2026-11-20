-- =============================================================================
-- Apostolic Moral Purity — initial schema
--
-- Every user-owned table:
--   * has user_id referencing auth.users with ON DELETE CASCADE, so deleting
--     the auth user (Settings → Delete Account) erases all of their data;
--   * has Row Level Security enabled with owner-only policies.
--
-- Mirrors the Base44 entities: UserProfile, CheckIn, JournalEntry, TriggerLog,
-- GroundingSession, AccountabilityContact, LibraryArticle.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (Base44: UserProfile) — one row per user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  track text not null check (track in ('men', 'spouse')),
  reason text not null default '' check (char_length(reason) <= 5000),
  primary_needs text[] not null default '{}' check (cardinality(primary_needs) <= 3),
  display_name text not null default '' check (char_length(display_name) <= 80),
  daily_reminders boolean not null default true,
  reminder_time time not null default '20:00',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- check_ins (Base44: CheckIn)
-- ---------------------------------------------------------------------------
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track text not null check (track in ('men', 'spouse')),
  -- The user's local calendar date, computed on-device.
  date date not null,
  emotional_state text not null default '' check (char_length(emotional_state) <= 80),
  custom_emotion text not null default '' check (char_length(custom_emotion) <= 200),
  intensity smallint check (intensity between 1 and 10),
  temptation_level smallint check (temptation_level between 1 and 10),
  stress_level smallint check (stress_level between 1 and 10),
  recent_triggers text not null default '' check (char_length(recent_triggers) <= 10000),
  spiritual_condition text not null default '' check (char_length(spiritual_condition) <= 40),
  honesty_check text not null default '' check (char_length(honesty_check) <= 10000),
  next_step text not null default '' check (char_length(next_step) <= 10000),
  body_awareness text not null default '' check (char_length(body_awareness) <= 40),
  primary_fear text not null default '' check (char_length(primary_fear) <= 10000),
  current_need text not null default '' check (char_length(current_need) <= 40),
  reflection text not null default '' check (char_length(reflection) <= 10000),
  created_at timestamptz not null default now()
);
create index check_ins_user_date_idx on public.check_ins (user_id, date desc);

-- ---------------------------------------------------------------------------
-- journal_entries (Base44: JournalEntry)
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  track text check (track in ('men', 'spouse')),
  title text not null default '' check (char_length(title) <= 200),
  content text not null check (char_length(content) between 1 and 100000),
  category text not null default 'free_writing' check (char_length(category) <= 60),
  prompt_used text not null default '' check (char_length(prompt_used) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- trigger_logs (Base44: TriggerLog)
-- ---------------------------------------------------------------------------
create table public.trigger_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emotional_state text not null check (char_length(emotional_state) between 1 and 80),
  trigger_type text not null check (
    trigger_type in ('visual', 'emotional', 'relational', 'situational', 'spiritual', 'physical', 'digital', 'other')
  ),
  intensity smallint not null default 5 check (intensity between 1 and 10),
  event_description text not null default '' check (char_length(event_description) <= 10000),
  thoughts text not null default '' check (char_length(thoughts) <= 10000),
  physical_sensations text not null default '' check (char_length(physical_sensations) <= 10000),
  response_pattern text not null default '' check (
    response_pattern in ('', 'healthy_coping', 'avoidance', 'acting_out', 'isolation', 'reaching_out', 'grounding', 'other')
  ),
  healthy_next_step text not null default '' check (char_length(healthy_next_step) <= 10000),
  created_at timestamptz not null default now()
);
create index trigger_logs_user_created_idx on public.trigger_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- grounding_sessions (Base44: GroundingSession)
-- ---------------------------------------------------------------------------
create table public.grounding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (
    type in ('breathing', 'body_grounding', 'orienting', 'prayer', 'truth_reminder', 'scripture', 'reassurance', 'guide')
  ),
  created_at timestamptz not null default now()
);
create index grounding_sessions_user_created_idx on public.grounding_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- accountability_contacts (Base44: AccountabilityContact)
-- ---------------------------------------------------------------------------
create table public.accountability_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null default '' check (
    email = '' or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  phone text not null default '' check (char_length(phone) <= 40),
  relationship text not null default '' check (char_length(relationship) <= 80),
  created_at timestamptz not null default now()
);
create index accountability_contacts_user_idx on public.accountability_contacts (user_id, created_at);

-- ---------------------------------------------------------------------------
-- library_articles (Base44: LibraryArticle) — shared content, admin-managed
-- ---------------------------------------------------------------------------
create table public.library_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null check (
    category in ('scripture_teaching', 'recovery', 'emotional_health', 'spiritual_formation', 'spouse_support', 'identity', 'accountability')
  ),
  track text not null default 'both' check (track in ('men', 'spouse', 'both')),
  scripture_reference text not null default '',
  read_time_minutes smallint check (read_time_minutes > 0),
  tags text not null default '',
  featured boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index library_articles_published_idx on public.library_articles (published, created_at desc);

-- ---------------------------------------------------------------------------
-- outbound_emails — rate limiting + audit for the send-support-email function.
-- Written only by the service role; users can see their own history.
-- ---------------------------------------------------------------------------
create table public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.accountability_contacts (id) on delete set null,
  kind text not null check (kind in ('support', 'check_in_request')),
  created_at timestamptz not null default now()
);
create index outbound_emails_user_created_idx on public.outbound_emails (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_usage — per-user rate limiting for the grounding-guide function.
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();
create trigger library_articles_updated_at before update on public.library_articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.check_ins enable row level security;
alter table public.journal_entries enable row level security;
alter table public.trigger_logs enable row level security;
alter table public.grounding_sessions enable row level security;
alter table public.accountability_contacts enable row level security;
alter table public.library_articles enable row level security;
alter table public.outbound_emails enable row level security;
alter table public.ai_usage enable row level security;

-- Owner-only CRUD on every personal table. `(select auth.uid())` is evaluated
-- once per statement rather than per row (Supabase performance guidance).
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'check_ins', 'journal_entries', 'trigger_logs', 'grounding_sessions', 'accountability_contacts']
  loop
    execute format($f$
      create policy "%1$s: owner can read" on public.%1$I
        for select to authenticated using (user_id = (select auth.uid()));
      create policy "%1$s: owner can insert" on public.%1$I
        for insert to authenticated with check (user_id = (select auth.uid()));
      create policy "%1$s: owner can update" on public.%1$I
        for update to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()));
      create policy "%1$s: owner can delete" on public.%1$I
        for delete to authenticated using (user_id = (select auth.uid()));
    $f$, t);
  end loop;
end;
$$;

-- Library: any signed-in user can read published articles. Writes happen in
-- the Supabase dashboard (or via the service role), never from the app.
create policy "library_articles: signed-in users read published" on public.library_articles
  for select to authenticated using (published);

-- Email + AI logs: users may read their own history; only the service role writes.
create policy "outbound_emails: owner can read" on public.outbound_emails
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_usage: owner can read" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- Least privilege for the anon role: nothing in this app is public.
revoke all on all tables in schema public from anon;
