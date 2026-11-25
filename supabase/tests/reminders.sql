-- Daily check-in reminder assertions. Run by supabase/tests/run.sh last.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
reset role;

-- The clock math, including just after midnight.
do $$ begin
  if public.reminder_minutes_late('2026-11-25 20:00:30', '20:00') <> 0 then raise exception 'on time'; end if;
  if public.reminder_minutes_late('2026-11-25 20:09:59', '20:00') <> 9 then raise exception '9 late'; end if;
  if public.reminder_minutes_late('2026-11-25 19:59:00', '20:00') <> 1439 then raise exception 'not yet'; end if;
  if public.reminder_minutes_late('2026-11-25 00:03:00', '23:58') <> 5 then raise exception 'past midnight'; end if;
  if ('2026-11-25 00:03:00'::timestamp - make_interval(mins => 5))::date <> '2026-11-24' then
    raise exception 'past midnight counts for the day before';
  end if;
end $$;

insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-000000000001', 'due@example.com'),
  ('e0000000-0000-4000-8000-000000000002', 'checked-in@example.com'),
  ('e0000000-0000-4000-8000-000000000003', 'later@example.com'),
  ('e0000000-0000-4000-8000-000000000004', 'phone-app@example.com'),
  ('e0000000-0000-4000-8000-000000000005', 'reminders-off@example.com'),
  ('e0000000-0000-4000-8000-000000000006', 'tokyo@example.com'),
  ('e0000000-0000-4000-8000-000000000007', 'bad-zone@example.com');

-- Reminder times relative to now in each person's time zone.
create function pg_temp.at(tz text, minutes integer) returns time language sql as
  $$ select (date_trunc('minute', now() at time zone tz) + make_interval(mins => minutes))::time $$;

insert into public.profiles (user_id, track, display_name, onboarding_complete, daily_reminders, reminder_time, timezone) values
  ('e0000000-0000-4000-8000-000000000001', 'men', 'Due', true, true, pg_temp.at('America/Chicago', -1), 'America/Chicago'),
  ('e0000000-0000-4000-8000-000000000002', 'men', 'Done', true, true, pg_temp.at('America/Chicago', -1), 'America/Chicago'),
  ('e0000000-0000-4000-8000-000000000003', 'men', 'Later', true, true, pg_temp.at('America/Chicago', 30), 'America/Chicago'),
  ('e0000000-0000-4000-8000-000000000004', 'men', 'App', true, true, pg_temp.at('America/Chicago', -1), 'America/Chicago'),
  ('e0000000-0000-4000-8000-000000000005', 'men', 'Off', true, false, pg_temp.at('America/Chicago', -1), 'America/Chicago'),
  ('e0000000-0000-4000-8000-000000000006', 'spouse', 'Tokyo', true, true, pg_temp.at('Asia/Tokyo', -2), 'Asia/Tokyo'),
  ('e0000000-0000-4000-8000-000000000007', 'men', 'Mars', true, true, pg_temp.at('UTC', -1), 'Mars/Olympus');

-- "Done" already checked in that day (the local day of their reminder).
insert into public.check_ins (user_id, track, date)
values ('e0000000-0000-4000-8000-000000000002', 'men',
        ((now() at time zone 'America/Chicago') - interval '1 minute')::date);

-- Everyone has a web device, except "App", who only has the phone app
-- (which schedules its own reminders).
insert into public.push_subscriptions (user_id, platform, endpoint, p256dh, auth)
select id, 'web', 'https://push.example.com/' || id, 'p256dh', 'auth' from auth.users
where email like '%@example.com' and id::text like 'e0000000%' and email <> 'phone-app@example.com';
insert into public.push_subscriptions (user_id, platform, endpoint)
values ('e0000000-0000-4000-8000-000000000004', 'ios', 'device-token-app');

do $$
declare
  sent integer;
begin
  if (select timezone from public.profiles where user_id = 'e0000000-0000-4000-8000-000000000007') is not null then
    raise exception 'an unknown time zone was kept';
  end if;

  sent := public.checkin_send_due_reminders();
  if sent <> 2 then raise exception 'expected 2 reminders (Due, Tokyo), got %', sent; end if;
  if (select array_agg(user_id order by user_id) from public.checkin_reminder_log)
     <> array['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006']::uuid[] then
    raise exception 'wrong people reminded: %', (select array_agg(user_id) from public.checkin_reminder_log);
  end if;
  if (select local_date from public.checkin_reminder_log where user_id = 'e0000000-0000-4000-8000-000000000006')
     <> ((now() at time zone 'Asia/Tokyo') - interval '2 minutes')::date then
    raise exception 'reminder day should be the local day in Tokyo';
  end if;

  -- Once a day: running again sends nothing.
  if public.checkin_send_due_reminders() <> 0 then raise exception 'reminded twice'; end if;
end $$;

-- Nobody signed in can run the scheduler or read the log.
set role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000001', false);
do $$ begin
  begin
    perform public.checkin_send_due_reminders();
    raise exception 'a person ran the reminder scheduler';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.checkin_reminder_log;
    raise exception 'a person read the reminder log';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\o
select 'Reminder tests passed' as result;
