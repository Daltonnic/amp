-- Calendar assertions. Run by supabase/tests/run.sh after chat.sql.
-- People from chat.sql: David (man, recovery), Paul (man, recovery),
-- Ruth (woman, recovery), Anna (woman, betrayed), Joy (woman, betrayed; the
-- only leader by now).
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
reset role;
create function pg_temp.act_as(uid text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', uid, false) $$;
set role authenticated;

-- Only leaders add events.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
do $$ begin
  begin
    insert into public.calendar_events (rooms, title, starts_local, timezone)
    values (array['men-recovery'], 'Not allowed', '2026-12-01 19:00', 'America/Chicago');
    raise exception 'a non-leader added an event';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Joy (a leader) adds a weekly men's meeting that crosses the end of daylight
-- saving (Nov 1, 2026), and a monthly meeting for betrayed women on the 31st.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
insert into public.calendar_events (rooms, title, starts_local, timezone, repeat, reminders)
values (array['men-recovery'], 'Tuesday Night Group', '2026-10-27 19:00', 'America/Chicago', 'weekly', '{1440,60}');
insert into public.calendar_events (rooms, title, starts_local, timezone, repeat, repeat_until, duration_minutes)
values (array['women-betrayed'], 'Monthly Healing Circle', '2027-01-31 10:00', 'America/New_York', 'monthly', '2027-04-30', 90);

do $$ begin
  begin
    insert into public.calendar_events (rooms, title, starts_local, timezone)
    values (array['men-recovery'], 'Bad zone', '2026-12-01 19:00', 'Mars/Olympus');
    raise exception 'unknown time zone accepted';
  exception when raise_exception then
    if sqlerrm not like 'Unknown time zone%' then raise; end if;
  end;
  begin
    insert into public.calendar_events (rooms, title, starts_local, timezone, reminders)
    values (array['men-recovery'], 'Odd reminder', '2026-12-01 19:00', 'UTC', '{7}');
    raise exception 'non-preset reminder accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.calendar_events (rooms, title, starts_local, timezone)
    values (array['everyone'], 'Bad group', '2026-12-01 19:00', 'UTC');
    raise exception 'unknown group accepted';
  exception when check_violation then null;
  end;
  -- Leaders see every section's events.
  if (select count(distinct event_id) from public.calendar_occurrences('2026-10-01', '2027-06-01')) <> 2 then
    raise exception 'leader should see both events';
  end if;
end $$;

-- David (men in recovery) sees the weekly meeting at 7 PM local, before and
-- after the clocks change, and nothing from the women's groups.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
do $$
declare
  n int;
begin
  select count(*) into n from public.calendar_occurrences('2026-10-20', '2026-11-24');
  if n <> 4 then raise exception 'expected 4 weekly meetings, got %', n; end if;
  if not (select bool_and((starts_at at time zone 'America/Chicago')::time = '19:00')
          from public.calendar_occurrences('2026-10-20', '2026-11-24')) then
    raise exception 'weekly meeting moved off 7 PM across daylight saving';
  end if;
  if (select count(distinct (starts_at at time zone 'UTC')::time) from public.calendar_occurrences('2026-10-20', '2026-11-24')) <> 2 then
    raise exception 'UTC time should shift by an hour after daylight saving ends';
  end if;
  if exists (select 1 from public.calendar_occurrences('2026-10-01', '2027-06-01') where title like 'Monthly%') then
    raise exception 'men see a women''s event';
  end if;
  begin
    update public.calendar_events set title = 'Hijacked';
    if exists (select 1 from public.calendar_events where title = 'Hijacked') then
      raise exception 'a non-leader edited an event';
    end if;
  end;
end $$;

-- Ruth (women in recovery) sees neither.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000005');
do $$ begin
  if (select count(*) from public.calendar_occurrences('2026-10-01', '2027-06-01')) <> 0 then
    raise exception 'women in recovery see other sections'' events';
  end if;
end $$;

-- Anna (betrayed women) sees the monthly meeting: Jan 31, then the last day of
-- shorter months, and nothing after "repeat until".
select pg_temp.act_as('c0000000-0000-4000-8000-000000000006');
do $$
declare
  days text;
begin
  select string_agg(to_char(starts_local, 'YYYY-MM-DD HH24:MI'), ',' order by starts_at) into days
  from public.calendar_occurrences('2027-01-01', '2027-07-01');
  if days <> '2027-01-31 10:00,2027-02-28 10:00,2027-03-31 10:00,2027-04-30 10:00' then
    raise exception 'monthly occurrences wrong: %', days;
  end if;
  if (select ends_at - starts_at from public.calendar_occurrences('2027-01-01', '2027-02-01')) <> interval '90 minutes' then
    raise exception 'duration not applied';
  end if;
end $$;

-- Notification choices: David wants meetings; Paul only messages.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
select public.push_register('web', 'https://push.example.org/david', 'BD', 'ad', false, true, true);
select pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
select public.push_register('web', 'https://push.example.org/paul2', 'BP', 'ap', false, true, false);
-- Re-registering without choices keeps them.
select public.push_register('web', 'https://push.example.org/paul2', 'BP', 'ap');

-- Reminders: a meeting an hour from now with a 1-hour reminder is due now,
-- and goes out once.
reset role;
insert into public.calendar_events (rooms, title, starts_local, timezone, reminders)
values (array['men-recovery'], 'Starts in an hour', (now() at time zone 'UTC') + interval '60 minutes', 'UTC', '{60}');
do $$
declare
  ev uuid;
begin
  if (select notify_events from public.push_subscriptions where endpoint = 'https://push.example.org/paul2') then
    raise exception 'omitted choices should be kept';
  end if;
  if public.calendar_send_due_reminders() < 1 then raise exception 'due reminder not sent'; end if;
  if public.calendar_send_due_reminders() <> 0 then raise exception 'reminder sent twice'; end if;
  select id into ev from public.calendar_events where title = 'Starts in an hour';
  if not exists (select 1 from public.calendar_reminder_log where event_id = ev and minutes_before = 60) then
    raise exception 'reminder not logged';
  end if;
  -- Recipients: men in recovery who want meeting notifications (David, not Paul).
  if (select string_agg(endpoint, ',') from public.calendar_push_recipients(ev)) <> 'https://push.example.org/david' then
    raise exception 'wrong meeting recipients: %', (select string_agg(endpoint, ',') from public.calendar_push_recipients(ev));
  end if;
end $$;

-- Paul turns message notifications off: his device no longer gets message pushes.
set role authenticated;
select pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
select public.push_register('web', 'https://push.example.org/paul2', 'BP', 'ap', null, false, null);
reset role;
do $$
declare
  msg uuid;
begin
  select id into msg from public.chat_messages
  where room = 'men-recovery' and kind = 'text' and deleted_at is null and user_id = 'c0000000-0000-4000-8000-000000000001'
  limit 1;
  if exists (select 1 from public.push_recipients(msg) where endpoint = 'https://push.example.org/paul2') then
    raise exception 'message push sent to a device that turned messages off';
  end if;
end $$;

-- RSVPs: David is going to the next Tuesday Night Group, Paul can't make it.
set role authenticated;
select pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
do $$
declare
  ev uuid;
  next_start timestamptz;
  s record;
begin
  select event_id, starts_at into ev, next_start
  from public.calendar_occurrences(now(), now() + interval '8 days')
  where title = 'Tuesday Night Group' order by starts_at limit 1;
  perform public.calendar_rsvp(ev, next_start, 'yes');
  perform pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
  perform public.calendar_rsvp(ev, next_start, 'no');

  select * into s from public.calendar_rsvp_summary(now(), now() + interval '8 days') where event_id = ev;
  if s.going <> 1 or s.not_going <> 1 or s.mine <> 'no' then
    raise exception 'summary wrong for Paul: % % %', s.going, s.not_going, s.mine;
  end if;

  -- Only leaders see who; members see counts only.
  if (select count(*) from public.calendar_rsvp_people(ev, next_start)) <> 0 then
    raise exception 'a member can see who RSVPed';
  end if;
  if exists (select 1 from public.calendar_rsvps where user_id <> 'c0000000-0000-4000-8000-000000000004') then
    raise exception 'a member can read other people''s RSVPs';
  end if;

  -- A date that isn't a meeting, or has passed, can't be answered.
  begin
    perform public.calendar_rsvp(ev, next_start + interval '3 minutes', 'yes');
    raise exception 'RSVP to a non-existent time accepted';
  exception when raise_exception then
    if sqlerrm not like '%doesn''t exist%' then raise; end if;
  end;
  begin
    perform public.calendar_rsvp(ev, '2026-10-28 00:00:00+00', 'yes');
    raise exception 'RSVP to a past meeting accepted';
  exception when raise_exception then
    if sqlerrm not like '%already happened%' then raise; end if;
  end;

  -- Someone outside the meeting's group can't answer.
  perform pg_temp.act_as('c0000000-0000-4000-8000-000000000005');
  begin
    perform public.calendar_rsvp(ev, next_start, 'yes');
    raise exception 'a woman RSVPed to a men''s meeting';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.calendar_rsvp_summary(now(), now() + interval '8 days') where event_id = ev) then
    raise exception 'a woman sees a men''s meeting RSVP counts';
  end if;

  -- The leader sees names (as chosen to show).
  perform pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
  if (select string_agg(shown_name || ':' || response, ',') from public.calendar_rsvp_people(ev, next_start)) <> 'Steady:yes,Paul:no' then
    raise exception 'leader RSVP list wrong: %', (select string_agg(shown_name || ':' || response, ',') from public.calendar_rsvp_people(ev, next_start));
  end if;

  -- David changes his mind to "can't make it": no reminder for that date.
  perform pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
  perform public.calendar_rsvp(ev, next_start, 'no');
  reset role;
  if exists (select 1 from public.calendar_push_recipients(ev, next_start) where endpoint = 'https://push.example.org/david') then
    raise exception 'reminder would go to someone who can''t make it';
  end if;
  if not exists (select 1 from public.calendar_push_recipients(ev, next_start + interval '7 days') where endpoint = 'https://push.example.org/david') then
    raise exception 'the next week''s reminder should still go to David';
  end if;
  set role authenticated;

  -- Clearing an answer.
  perform public.calendar_rsvp(ev, next_start, null);
  if exists (select 1 from public.calendar_rsvps where user_id = 'c0000000-0000-4000-8000-000000000001') then
    raise exception 'clearing an RSVP failed';
  end if;
end $$;
reset role;

-- Signed-out callers can't read the calendar.
set role anon;
do $$ begin
  begin
    perform * from public.calendar_occurrences(now(), now() + interval '1 day');
    raise exception 'anon read the calendar';
  exception when insufficient_privilege then null;
  end;
end $$;

\o
select 'Calendar tests passed' as result;
