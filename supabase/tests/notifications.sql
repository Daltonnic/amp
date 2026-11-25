-- Notifications assertions. Run by supabase/tests/run.sh after calendar.sql.
-- Joy (c…07, a woman in a betrayed spouses' group) is the only leader by now.
-- New people here: Eve, Lia, Mia and Kim, women in recovery.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
reset role;
create function pg_temp.act_as(uid text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', uid, false) $$;
create function pg_temp.count_for(uid text, k text) returns integer language sql as
  $$ select count(*)::integer from public.notifications where user_id = uid::uuid and kind = k $$;

insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-000000000001', 'eve@example.com'),
  ('d0000000-0000-4000-8000-000000000002', 'lia@example.com'),
  ('d0000000-0000-4000-8000-000000000003', 'mia@example.com'),
  ('d0000000-0000-4000-8000-000000000004', 'kim@example.com');

set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000001');
insert into public.profiles (track, gender, display_name) values ('men', 'woman', 'Eve');
select public.chat_join();
select pg_temp.act_as('d0000000-0000-4000-8000-000000000002');
insert into public.profiles (track, gender, display_name) values ('men', 'woman', 'Lia');
select public.chat_join();
select pg_temp.act_as('d0000000-0000-4000-8000-000000000003');
insert into public.profiles (track, gender, display_name) values ('men', 'woman', 'Mia');
select public.chat_join();

-- Each request reaches the leader, once.
reset role;
do $$ begin
  if pg_temp.count_for('c0000000-0000-4000-8000-000000000007', 'join_request') <> 3 then
    raise exception 'leader should have 3 join requests, has %', pg_temp.count_for('c0000000-0000-4000-8000-000000000007', 'join_request');
  end if;
  if not exists (select 1 from public.notifications where user_id = 'c0000000-0000-4000-8000-000000000007'
                 and title = 'Eve asked to join' and body = 'Women in Recovery' and url = '/moderators') then
    raise exception 'join request wording';
  end if;
end $$;

-- Joy approves Eve and Lia, declines Mia.
set role authenticated;
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
select public.leader_review_request('d0000000-0000-4000-8000-000000000001', true);
select public.leader_review_request('d0000000-0000-4000-8000-000000000002', true);
select public.leader_review_request('d0000000-0000-4000-8000-000000000003', false);
do $$ begin
  -- Joy only sees her own notifications; handled requests read as handled.
  if (select count(*) from public.notifications where user_id <> 'c0000000-0000-4000-8000-000000000007') <> 0 then
    raise exception 'RLS: leader sees other people''s notifications';
  end if;
  if (select count(*) from public.notifications where kind = 'join_request') <> 0 then
    raise exception 'handled requests should no longer be requests';
  end if;
  if (select count(*) from public.notifications where kind = 'join_handled' and read_at is not null) <> 3 then
    raise exception 'handled requests should be marked read';
  end if;
  if not exists (select 1 from public.notifications where title = 'Eve joined Women in Recovery') then
    raise exception 'approved wording';
  end if;
  if not exists (select 1 from public.notifications where title = 'Mia wasn''t added to Women in Recovery') then
    raise exception 'declined wording';
  end if;
end $$;

select pg_temp.act_as('d0000000-0000-4000-8000-000000000001');
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'join_approved'
                 and title = 'You''re in! Welcome to Women in Recovery' and url = '/group' and read_at is null) then
    raise exception 'Eve should be told she is in';
  end if;
end $$;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000003');
do $$ begin
  if (select count(*) from public.notifications where kind = 'join_declined') <> 1 then
    raise exception 'Mia should be told her request was declined';
  end if;
  -- Mia can't remove or read Eve's notifications.
  delete from public.notifications where user_id = 'd0000000-0000-4000-8000-000000000001';
  if public.notifications_mark_read() <> 1 then raise exception 'Mia should mark her one notification read'; end if;
end $$;
reset role;
do $$ begin
  if pg_temp.count_for('d0000000-0000-4000-8000-000000000001', 'join_approved') <> 1 then
    raise exception 'Mia removed Eve''s notification';
  end if;
  if (select read_at from public.notifications where user_id = 'd0000000-0000-4000-8000-000000000001') is not null then
    raise exception 'Mia marked Eve''s notification read';
  end if;
end $$;

-- Replies -------------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000001');
select public.chat_send('Day 3. One day at a time.');
-- Replying to yourself doesn't notify you.
select public.chat_send('Still here.', (select id from public.chat_messages where body = 'Day 3. One day at a time.'));
select pg_temp.act_as('d0000000-0000-4000-8000-000000000002');
select public.chat_send('Proud of you, Eve!', (select id from public.chat_messages where body = 'Day 3. One day at a time.'));
reset role;
do $$ begin
  if pg_temp.count_for('d0000000-0000-4000-8000-000000000001', 'reply') <> 1 then
    raise exception 'Eve should have exactly one reply notification';
  end if;
  if not exists (select 1 from public.notifications where user_id = 'd0000000-0000-4000-8000-000000000001'
                 and kind = 'reply' and title = 'Lia replied to you' and body = 'Proud of you, Eve!') then
    raise exception 'reply wording';
  end if;
end $$;

-- A deleted reply takes its notification with it.
set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000002');
select public.chat_delete_message((select id from public.chat_messages where body = 'Proud of you, Eve!'));
reset role;
do $$ begin
  if pg_temp.count_for('d0000000-0000-4000-8000-000000000001', 'reply') <> 0 then
    raise exception 'deleted reply still notifies';
  end if;
end $$;

-- Someone Eve blocked can't notify her.
set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000001');
insert into public.chat_blocks (blocked) values ('d0000000-0000-4000-8000-000000000002');
select pg_temp.act_as('d0000000-0000-4000-8000-000000000002');
select public.chat_send('You''ve got this.', (select id from public.chat_messages where body = 'Day 3. One day at a time.'));
reset role;
do $$ begin
  if pg_temp.count_for('d0000000-0000-4000-8000-000000000001', 'reply') <> 0 then
    raise exception 'a blocked person notified Eve';
  end if;
end $$;

-- New leaders ---------------------------------------------------------------
-- Kim asks to join, then Joy makes Eve a leader: Eve hears she leads, and
-- sees Kim's request that was already waiting.
set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000004');
insert into public.profiles (track, gender, display_name) values ('men', 'woman', 'Kim');
select public.chat_join();
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
select public.leader_set_leader('d0000000-0000-4000-8000-000000000001', true);
reset role;
do $$ begin
  if pg_temp.count_for('d0000000-0000-4000-8000-000000000001', 'leader') <> 1 then
    raise exception 'new leader not told';
  end if;
  if not exists (select 1 from public.notifications where user_id = 'd0000000-0000-4000-8000-000000000001'
                 and kind = 'leader' and title = 'You''re now a moderator' and url = '/moderators') then
    raise exception 'new moderator wording';
  end if;
  if pg_temp.count_for('d0000000-0000-4000-8000-000000000001', 'join_request') <> 1 then
    raise exception 'new leader should see the waiting request';
  end if;
end $$;

-- Kim withdraws: the request disappears for every leader.
set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000004');
select public.chat_leave();
reset role;
do $$ begin
  if exists (select 1 from public.notifications where kind = 'join_request'
             and subject_user = 'd0000000-0000-4000-8000-000000000004') then
    raise exception 'withdrawn request still showing';
  end if;
end $$;

-- Stepping down clears request notifications.
set role authenticated;
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
select public.leader_set_leader('d0000000-0000-4000-8000-000000000001', false);
reset role;
do $$ begin
  if exists (select 1 from public.notifications where user_id = 'd0000000-0000-4000-8000-000000000001'
             and kind in ('join_request', 'join_handled')) then
    raise exception 'former leader still has request notifications';
  end if;
end $$;

-- Marking read --------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000001');
do $$ begin
  if (select count(*) from public.notifications where read_at is null) <> 2 then
    raise exception 'Eve should have 2 unread (joined, leader), has %', (select count(*) from public.notifications where read_at is null);
  end if;
  if public.notifications_mark_read(null, array['leader']) <> 1 then raise exception 'mark read by kind'; end if;
  if public.notifications_mark_read(array[(select id from public.notifications where kind = 'join_approved')]) <> 1 then
    raise exception 'mark read by id';
  end if;
  if public.notifications_mark_read() <> 0 then raise exception 'nothing left to mark read'; end if;
  -- People can't write notifications themselves.
  begin
    insert into public.notifications (user_id, kind, title) values (auth.uid(), 'leader', 'fake');
    raise exception 'a person wrote a notification';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.notifications set title = 'changed';
    raise exception 'a person edited a notification';
  exception when insufficient_privilege then null;
  end;
  -- Removing your own works.
  delete from public.notifications where kind = 'leader';
  if exists (select 1 from public.notifications where kind = 'leader') then raise exception 'remove own'; end if;
end $$;

-- Meeting reminders ---------------------------------------------------------
-- Joy adds a women's meeting starting in 58 minutes with a 1-hour reminder,
-- so the reminder is due now. Mia says she can't make it.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
insert into public.calendar_events (rooms, title, starts_local, timezone, reminders)
values (array['women-recovery'], 'Women''s Circle',
        date_trunc('minute', (now() at time zone 'UTC') + interval '58 minutes'), 'UTC', '{60}');
select pg_temp.act_as('d0000000-0000-4000-8000-000000000003');
select public.calendar_rsvp(
  (select id from public.calendar_events where title = 'Women''s Circle'),
  (select starts_at from public.calendar_occurrences(now(), now() + interval '2 hours') where title = 'Women''s Circle'),
  'no');
reset role;
select public.calendar_send_due_reminders();
select public.calendar_send_due_reminders(); -- already sent; nothing doubles
do $$
declare
  ev uuid := (select id from public.calendar_events where title = 'Women''s Circle');
  starts timestamptz := (select starts_at from public.calendar_occurrences(now(), now() + interval '2 hours') where event_id = ev);
begin
  -- Everyone in women's recovery (Eve, Lia, Kim and the women from
  -- chat.sql), except Mia, who can't make it.
  if (select count(*) from public.notifications where kind = 'meeting' and event_id = ev)
     <> (select count(*) - 1 from public.profiles where public.chat_room_for(track, gender) = 'women-recovery') then
    raise exception 'meeting notifications should reach the whole group but Mia';
  end if;
  if (select count(*) from public.notifications where kind = 'meeting' and event_id = ev and user_id in (
        'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002',
        'd0000000-0000-4000-8000-000000000004')) <> 3 then
    raise exception 'Eve, Lia and Kim should each get one meeting notification';
  end if;
  if exists (select 1 from public.notifications n join public.profiles p on p.user_id = n.user_id
             where n.kind = 'meeting' and n.event_id = ev
               and public.chat_room_for(p.track, p.gender) <> 'women-recovery') then
    raise exception 'meeting notification reached another group';
  end if;
  if exists (select 1 from public.notifications where kind = 'meeting' and user_id = 'd0000000-0000-4000-8000-000000000003') then
    raise exception 'Mia said she can''t make it but was reminded';
  end if;
  if not exists (select 1 from public.notifications where kind = 'meeting' and title = 'Women''s Circle'
                 and occurrence_start = starts
                 and url = '/calendar?event=' || ev || '&at=' || (extract(epoch from starts) * 1000)::bigint) then
    raise exception 'meeting notification link';
  end if;
end $$;

-- Lia says she can't make it after all: her reminder goes away.
set role authenticated;
select pg_temp.act_as('d0000000-0000-4000-8000-000000000002');
select public.calendar_rsvp(
  (select id from public.calendar_events where title = 'Women''s Circle'),
  (select starts_at from public.calendar_occurrences(now(), now() + interval '2 hours') where title = 'Women''s Circle'),
  'no');
reset role;
do $$ begin
  if pg_temp.count_for('d0000000-0000-4000-8000-000000000002', 'meeting') <> 0 then
    raise exception 'RSVP no should clear the reminder';
  end if;
end $$;

-- A deleted meeting takes its notifications with it.
delete from public.calendar_events where title = 'Women''s Circle';
do $$ begin
  if exists (select 1 from public.notifications where kind = 'meeting' and title = 'Women''s Circle') then
    raise exception 'deleted meeting still in notifications';
  end if;
  -- Old notifications are pruned.
  update public.notifications set created_at = now() - interval '91 days'
  where user_id = 'd0000000-0000-4000-8000-000000000003';
  if public.notifications_prune() <> 1 then raise exception 'prune'; end if;
end $$;

-- Signed-out callers see nothing.
set role anon;
do $$ begin
  begin
    perform 1 from public.notifications;
    raise exception 'anon read notifications';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\o
select 'Notification tests passed' as result;
