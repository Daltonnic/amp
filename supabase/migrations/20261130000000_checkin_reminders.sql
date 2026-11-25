-- =============================================================================
-- Daily check-in reminders as push notifications.
--
-- The iPhone and Android apps schedule reminders on the device. Everyone
-- else (the web app, including the Home Screen app on iPhone) gets them from
-- here: every minute, people whose reminder time has just come, in their own
-- time zone, and who haven't checked in yet that day, are sent one push to
-- each web device. At most one reminder per person per day.
-- =============================================================================

-- Each person's time zone (the app keeps it current), so reminders arrive at
-- their chosen local time.
alter table public.profiles
  add column timezone text check (timezone is null or char_length(timezone) <= 64);

-- Unknown time zones are dropped rather than breaking the scheduler.
create function public.profiles_check_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    new.timezone := null;
  end if;
  return new;
end;
$$;
create trigger profiles_check_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.profiles_check_timezone();

-- Who was reminded on which (local) day, so nobody is reminded twice.
create table public.checkin_reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
alter table public.checkin_reminder_log enable row level security;
grant select, insert, delete on public.checkin_reminder_log to service_role;

-- Minutes since today's reminder time at a local clock time, wrapping past
-- midnight (a 23:58 reminder at 00:03 is 5 minutes late, not -1435).
create function public.reminder_minutes_late(local_now timestamp, reminder_at time)
returns integer
language sql
immutable
set search_path = ''
as $$
  select mod(floor(extract(epoch from (local_now::time - reminder_at)) / 60)::integer + 1440, 1440)
$$;
revoke execute on function public.reminder_minutes_late(timestamp, time) from public, anon;

-- Sends the reminders that are due now; returns how many people were reminded.
-- "Due" means within 10 minutes after their reminder time (in case a run is
-- missed), on a day they haven't checked in, with reminders on and a web
-- device registered for push.
create function public.checkin_send_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due uuid[];
begin
  with people as (
    select p.user_id, p.reminder_time, (now() at time zone p.timezone) as local_now
    from public.profiles p
    where p.daily_reminders
      and p.onboarding_complete
      and p.timezone is not null
      and exists (
        select 1 from public.push_subscriptions s where s.user_id = p.user_id and s.platform = 'web'
      )
  ),
  timed as (
    select
      pe.user_id,
      pe.local_now,
      public.reminder_minutes_late(pe.local_now, pe.reminder_time) as minutes_late
    from people pe
  ),
  due_now as (
    select t.user_id, (t.local_now - make_interval(mins => t.minutes_late))::date as local_day
    from timed t
    where t.minutes_late < 10
  ),
  not_checked_in as (
    select d.user_id, d.local_day
    from due_now d
    where not exists (
      select 1 from public.check_ins c where c.user_id = d.user_id and c.date = d.local_day
    )
  ),
  logged as (
    insert into public.checkin_reminder_log (user_id, local_date)
    select n.user_id, n.local_day from not_checked_in n
    on conflict do nothing
    returning user_id
  )
  select array_agg(l.user_id) into due from logged l;

  if due is not null then
    perform public.push_webhook(jsonb_build_object('event', 'checkin_reminder', 'user_ids', to_jsonb(due)));
  end if;
  delete from public.checkin_reminder_log where local_date < current_date - 7;
  return coalesce(cardinality(due), 0);
end;
$$;
revoke execute on function public.checkin_send_due_reminders() from public, anon, authenticated;

-- Every minute, on Supabase (pg_cron isn't available in local tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('checkin-reminders', '* * * * *', 'select public.checkin_send_due_reminders()');
  end if;
end;
$$;
