-- =============================================================================
-- Calendar: meetings and events for each group, with reminder notifications.
--
-- * Leaders add, edit and delete events. An event belongs to one or more of
--   the four groups (sections).
-- * Everyone sees the events of the section their profile belongs to
--   (man/woman + track). Leaders see every event.
-- * An event can repeat (daily, weekly, every 2 weeks, monthly) and has
--   reminder times (minutes before it starts). Every minute, the scheduler
--   (pg_cron) sends due reminders through the notify-group function.
-- * Times are stored as the wall-clock time in the event's time zone, so a
--   7:00 PM weekly meeting stays at 7:00 PM across daylight-saving changes.
--
-- Notification types: each device chooses group messages and/or meetings.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Notification types per device
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions
  add column notify_messages boolean not null default true,
  add column notify_events boolean not null default true;

-- push_register gains the two choices. Omitted (null) choices keep what the
-- device already had, so older app versions don't reset them.
drop function public.push_register(text, text, text, text, boolean);
create function public.push_register(
  platform text,
  endpoint text,
  p256dh text default null,
  auth text default null,
  show_preview boolean default null,
  notify_messages boolean default null,
  notify_events boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  insert into public.push_subscriptions as s
    (user_id, platform, endpoint, p256dh, auth, show_preview, notify_messages, notify_events)
  values (uid, push_register.platform, push_register.endpoint, push_register.p256dh, push_register.auth,
          coalesce(push_register.show_preview, false),
          coalesce(push_register.notify_messages, true),
          coalesce(push_register.notify_events, true))
  on conflict on constraint push_subscriptions_endpoint_key do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    show_preview = coalesce(push_register.show_preview, s.show_preview),
    notify_messages = coalesce(push_register.notify_messages, s.notify_messages),
    notify_events = coalesce(push_register.notify_events, s.notify_events),
    updated_at = now();
  delete from public.push_subscriptions
  where id in (
    select id from public.push_subscriptions where user_id = uid
    order by updated_at desc offset 10
  );
end;
$$;
revoke execute on function public.push_register(text, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.push_register(text, text, text, text, boolean, boolean, boolean) to authenticated;

-- Group message pushes only go to devices that want messages.
create or replace function public.push_recipients(message_id uuid)
returns table (
  subscription_id uuid,
  user_id uuid,
  platform text,
  endpoint text,
  p256dh text,
  auth text,
  show_preview boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.platform, s.endpoint, s.p256dh, s.auth, s.show_preview
  from public.chat_messages m
  join public.chat_members cm
    on cm.room = m.room and cm.status = 'active' and cm.left_at is null and cm.user_id <> m.user_id
  join public.profiles p on p.user_id = cm.user_id and public.chat_room_for(p.track, p.gender) = m.room
  join public.push_subscriptions s on s.user_id = cm.user_id and s.notify_messages
  where m.id = push_recipients.message_id
    and m.kind = 'text'
    and m.deleted_at is null
    and not exists (select 1 from public.chat_bans b where b.user_id = cm.user_id and b.room = m.room)
    and not exists (select 1 from public.chat_blocks k where k.blocker = cm.user_id and k.blocked = m.user_id)
$$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
-- The section (group) a person's profile belongs in.
create function public.my_profile_room()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.chat_room_for(p.track, p.gender) from public.profiles p where p.user_id = auth.uid()
$$;

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  rooms text[] not null check (
    cardinality(rooms) >= 1
    and rooms <@ array['men-recovery', 'women-recovery', 'men-betrayed', 'women-betrayed']::text[]
  ),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  location text not null default '' check (char_length(location) <= 300),
  -- Wall-clock start in `timezone` (e.g. 2026-12-01 19:00 in America/Chicago).
  starts_local timestamp not null,
  timezone text not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 1440),
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
  repeat_until date,
  -- Minutes before the start to send a reminder (the app's presets).
  reminders integer[] not null default '{1440,60}' check (
    cardinality(reminders) <= 9
    and reminders <@ array[0, 5, 15, 30, 60, 120, 1440, 2880, 10080]
  ),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (repeat_until is null or repeat_until >= starts_local::date)
);
create index calendar_events_rooms_idx on public.calendar_events using gin (rooms);

create function public.calendar_events_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  begin
    perform now() at time zone new.timezone;
  exception when others then
    raise exception 'Unknown time zone: %', new.timezone;
  end;
  new.title := btrim(new.title);
  new.updated_at := now();
  return new;
end;
$$;

create trigger calendar_events_validate
  before insert or update on public.calendar_events
  for each row execute function public.calendar_events_validate();

alter table public.calendar_events enable row level security;

create policy "calendar_events: see your section (leaders see all)" on public.calendar_events
  for select to authenticated
  using ((select public.is_leader()) or rooms && array[(select public.my_profile_room())]);
create policy "calendar_events: leaders add" on public.calendar_events
  for insert to authenticated with check ((select public.is_leader()));
create policy "calendar_events: leaders edit" on public.calendar_events
  for update to authenticated using ((select public.is_leader())) with check ((select public.is_leader()));
create policy "calendar_events: leaders delete" on public.calendar_events
  for delete to authenticated using ((select public.is_leader()));

grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.calendar_events to service_role;

-- Every occurrence (including repeats) that overlaps [range_start, range_end).
-- Runs as the caller, so people only get events they're allowed to see.
create function public.calendar_occurrences(range_start timestamptz, range_end timestamptz)
returns table (
  event_id uuid,
  title text,
  description text,
  location text,
  rooms text[],
  repeat text,
  repeat_until date,
  timezone text,
  duration_minutes integer,
  reminders integer[],
  starts_local timestamp,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with ev as (
    select
      e.*,
      case e.repeat
        when 'daily' then interval '1 day'
        when 'weekly' then interval '7 days'
        when 'biweekly' then interval '14 days'
        when 'monthly' then interval '1 month'
      end as step,
      -- Bounds for how many steps fit in a span (a month is 28–31 days).
      extract(epoch from case e.repeat
        when 'daily' then interval '1 day' when 'weekly' then interval '7 days'
        when 'biweekly' then interval '14 days' when 'monthly' then interval '28 days' end) as step_min,
      extract(epoch from case e.repeat
        when 'daily' then interval '1 day' when 'weekly' then interval '7 days'
        when 'biweekly' then interval '14 days' when 'monthly' then interval '31 days' end) as step_max
    from public.calendar_events e
    where (e.starts_local at time zone e.timezone) < calendar_occurrences.range_end
  )
  select
    ev.id, ev.title, ev.description, ev.location, ev.rooms, ev.repeat, ev.repeat_until, ev.timezone,
    ev.duration_minutes, ev.reminders, o.local_start,
    o.local_start at time zone ev.timezone,
    (o.local_start at time zone ev.timezone) + make_interval(mins => ev.duration_minutes)
  from ev
  cross join lateral (
    select ev.starts_local + n * coalesce(ev.step, interval '0') as local_start
    from generate_series(
      case when ev.step is null then 0 else greatest(0, floor(
        extract(epoch from ((calendar_occurrences.range_start at time zone ev.timezone) - ev.starts_local))
        / ev.step_max)::int - 1) end,
      case when ev.step is null then 0 else least(ceil(
        extract(epoch from ((calendar_occurrences.range_end at time zone ev.timezone) - ev.starts_local))
        / ev.step_min)::int + 1, 100000) end
    ) as n
  ) o
  where (ev.repeat_until is null or o.local_start::date <= ev.repeat_until)
    and (o.local_start at time zone ev.timezone) < calendar_occurrences.range_end
    and (o.local_start at time zone ev.timezone) + make_interval(mins => ev.duration_minutes)
        > calendar_occurrences.range_start
  order by 12
$$;

revoke execute on function public.calendar_occurrences(timestamptz, timestamptz) from public, anon;
grant execute on function public.calendar_occurrences(timestamptz, timestamptz) to authenticated, service_role;
revoke execute on function public.my_profile_room() from public, anon;
grant execute on function public.my_profile_room() to authenticated;

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------
-- One row per reminder sent, so each goes out once.
create table public.calendar_reminder_log (
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  occurrence_start timestamptz not null,
  minutes_before integer not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, occurrence_start, minutes_before)
);
alter table public.calendar_reminder_log enable row level security;
grant select, insert, delete on public.calendar_reminder_log to service_role;

-- Devices to remind about an event: people whose section is one of the
-- event's groups and who want meeting notifications.
create function public.calendar_push_recipients(event_id uuid)
returns table (
  subscription_id uuid,
  user_id uuid,
  platform text,
  endpoint text,
  p256dh text,
  auth text,
  show_preview boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, s.platform, s.endpoint, s.p256dh, s.auth, s.show_preview
  from public.calendar_events e
  join public.profiles p on public.chat_room_for(p.track, p.gender) = any (e.rooms)
  join public.push_subscriptions s on s.user_id = p.user_id and s.notify_events
  where e.id = calendar_push_recipients.event_id
$$;
revoke execute on function public.calendar_push_recipients(uuid) from public, anon, authenticated;
grant execute on function public.calendar_push_recipients(uuid) to service_role;

-- Sends every reminder that has come due in the last few minutes (and not yet
-- been sent). Run every minute by pg_cron; returns how many were sent.
create function public.calendar_send_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec record;
  sent integer := 0;
begin
  for rec in
    select o.event_id, o.starts_at, r.mins
    from public.calendar_occurrences(now() - interval '10 minutes', now() + interval '8 days') o
    cross join lateral unnest(o.reminders) as r(mins)
    where o.starts_at - make_interval(mins => r.mins) <= now()
      and o.starts_at - make_interval(mins => r.mins) > now() - interval '5 minutes'
  loop
    insert into public.calendar_reminder_log (event_id, occurrence_start, minutes_before)
    values (rec.event_id, rec.starts_at, rec.mins)
    on conflict do nothing;
    if found then
      perform public.push_webhook(jsonb_build_object(
        'event', 'calendar_reminder',
        'event_id', rec.event_id,
        'starts_at', rec.starts_at,
        'minutes', rec.mins
      ));
      sent := sent + 1;
    end if;
  end loop;
  -- Keep the log small.
  delete from public.calendar_reminder_log where occurrence_start < now() - interval '30 days';
  return sent;
end;
$$;
revoke execute on function public.calendar_send_due_reminders() from public, anon, authenticated;

-- Every minute, on Supabase (pg_cron isn't available in local tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('calendar-reminders', '* * * * *', 'select public.calendar_send_due_reminders()');
  end if;
end;
$$;
