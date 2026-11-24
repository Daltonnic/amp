-- Group chat assertions. Run by supabase/tests/run.sh after rls.sql.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
reset role;

-- Names ----------------------------------------------------------------------
do $$ begin
  if public.public_name('David', 'Miller', 'first_last_initial', '') <> 'David M.' then raise exception 'name: first_last_initial'; end if;
  if public.public_name('David', 'Miller', 'first', '') <> 'David' then raise exception 'name: first'; end if;
  if public.public_name('david', 'miller', 'initials', '') <> 'D.M.' then raise exception 'name: initials'; end if;
  if public.public_name(' David ', 'Miller', 'full', '') <> 'David Miller' then raise exception 'name: full'; end if;
  if public.public_name('David', '', 'full', '') <> 'David' then raise exception 'name: full without last'; end if;
  if public.public_name('David', '', 'first_last_initial', '') <> 'David' then raise exception 'name: no last initial'; end if;
  if public.public_name('David', 'Miller', 'nickname', ' Steady ') <> 'Steady' then raise exception 'name: nickname'; end if;
  if public.public_name('David', 'Miller', 'nickname', '') is not null then raise exception 'name: empty nickname'; end if;
  if public.public_name('', '', 'first_last_initial', '') is not null then raise exception 'name: empty'; end if;
  if public.chat_room_for('men', 'man') <> 'men-recovery' then raise exception 'room: men-recovery'; end if;
  if public.chat_room_for('men', 'woman') <> 'women-recovery' then raise exception 'room: women-recovery'; end if;
  if public.chat_room_for('spouse', 'man') <> 'men-betrayed' then raise exception 'room: men-betrayed'; end if;
  if public.chat_room_for('spouse', 'woman') <> 'women-betrayed' then raise exception 'room: women-betrayed'; end if;
  if public.chat_room_for('men', null) is not null then raise exception 'room: unknown gender'; end if;
end $$;

insert into auth.users (id, email) values
  ('c0000000-0000-4000-8000-000000000001', 'man1@example.com'),
  ('c0000000-0000-4000-8000-000000000002', 'man2@example.com'),
  ('c0000000-0000-4000-8000-000000000003', 'man3@example.com'),
  ('c0000000-0000-4000-8000-000000000004', 'mod@example.com'),
  ('c0000000-0000-4000-8000-000000000005', 'woman@example.com'),
  ('c0000000-0000-4000-8000-000000000006', 'wife@example.com');

create function pg_temp.act_as(uid text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', uid, false) $$;

set role authenticated;

-- Profiles: four men in recovery, a woman in recovery, a betrayed wife.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
insert into public.profiles (track, gender, display_name, last_name) values ('men', 'man', 'David', 'Miller');
select pg_temp.act_as('c0000000-0000-4000-8000-000000000002');
insert into public.profiles (track, gender, display_name, name_display) values ('men', 'man', 'Mark', 'first');
select pg_temp.act_as('c0000000-0000-4000-8000-000000000003');
insert into public.profiles (track, gender, display_name) values ('men', 'man', 'Luke');
select pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
insert into public.profiles (track, gender, display_name) values ('men', 'man', 'Paul');
select pg_temp.act_as('c0000000-0000-4000-8000-000000000005');
insert into public.profiles (track, gender, display_name) values ('men', 'woman', 'Ruth');
select pg_temp.act_as('c0000000-0000-4000-8000-000000000006');
insert into public.profiles (track, gender, display_name) values ('spouse', 'woman', 'Anna');

-- Not a member yet: sees nothing and can't post.
do $$ begin
  if (select count(*) from public.chat_messages) <> 0 then raise exception 'non-member can read messages'; end if;
  begin
    perform public.chat_send('hello');
    raise exception 'non-member could send';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The app can't write chat tables directly.
do $$ begin
  begin
    insert into public.chat_messages (room, user_id, body) values ('women-betrayed', 'c0000000-0000-4000-8000-000000000006', 'x');
    raise exception 'direct insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.chat_members (user_id, room, display_name) values ('c0000000-0000-4000-8000-000000000006', 'men-recovery', 'x');
    raise exception 'direct member insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Paul is the first leader (set with SQL, as in docs/GROUP_CHAT.md).
reset role;
insert into public.leaders (user_id) values ('c0000000-0000-4000-8000-000000000004');
set role authenticated;

-- Everyone asks to join their own group. Paul, a leader, goes straight in;
-- everyone else waits for a leader.
do $$
declare
  m public.chat_members;
  waiting uuid;
  ids text[] := array['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
                      'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004',
                      'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006'];
  rooms text[] := array['men-recovery', 'men-recovery', 'men-recovery', 'men-recovery', 'women-recovery', 'women-betrayed'];
begin
  for i in 1..6 loop
    perform pg_temp.act_as(ids[i]);
    m := public.chat_join();
    if m.room <> rooms[i] then raise exception 'joined % instead of %', m.room, rooms[i]; end if;
    if m.status <> (case when i = 4 then 'active' else 'pending' end) then
      raise exception 'user % joined as %', i, m.status;
    end if;
  end loop;

  -- Waiting people can't read or post, and can't approve themselves.
  perform pg_temp.act_as(ids[1]);
  if (select count(*) from public.chat_messages) <> 0 then raise exception 'pending member can read'; end if;
  begin
    perform public.chat_send('hello');
    raise exception 'pending member could post';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.leader_people()) <> 0 then raise exception 'non-leader sees people list'; end if;
  begin
    perform public.leader_review_request(ids[1]::uuid, true);
    raise exception 'non-leader approved a request';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.leader_set_leader(ids[1]::uuid, true);
    raise exception 'non-leader made a leader';
  exception when insufficient_privilege then null;
  end;

  -- Paul's group can't see people who are still waiting.
  perform pg_temp.act_as(ids[4]);
  if (select count(*) from public.chat_members where user_id <> ids[4]::uuid) <> 0 then
    raise exception 'waiting people visible to the group';
  end if;

  -- Paul sees every request (all groups) and approves them.
  if (select count(*) from public.leader_people() where member_status = 'pending') <> 5 then
    raise exception 'leader should see 5 requests';
  end if;
  if (select shown_name from public.leader_people() where user_id = ids[5]::uuid) <> 'Ruth' then
    raise exception 'leader should see the name people chose to show';
  end if;
  -- …and nothing else that identifies them: no email or real names.
  if pg_get_function_result('public.leader_people()'::regprocedure) ~* '(email|first_name|last_name)' then
    raise exception 'leader_people exposes email or real names';
  end if;
  foreach waiting in array array[ids[1], ids[2], ids[3], ids[5], ids[6]]::uuid[] loop
    perform public.leader_review_request(waiting, true);
  end loop;
  begin
    perform public.leader_review_request(ids[1]::uuid, true);
    raise exception 'approved twice';
  exception when raise_exception then
    if sqlerrm not like '%already handled%' then raise; end if;
  end;

  perform pg_temp.act_as(ids[1]);
  if (select display_name from public.chat_members where user_id = ids[1]::uuid) <> 'David M.' then
    raise exception 'display name not derived from profile';
  end if;
  if (select count(*) from public.chat_messages where kind = 'system' and body = 'joined the group') <> 4 then
    raise exception 'approved members should be announced in their group';
  end if;
end $$;

-- Members can't promote themselves.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000002');
do $$ begin
  begin
    update public.chat_members set role = 'moderator' where user_id = 'c0000000-0000-4000-8000-000000000002';
    raise exception 'member changed own role';
  exception when insufficient_privilege then null;
  end;
end $$;

-- David posts; the other men see it, the women don't.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
select public.chat_send('Day 30 today. Grateful for this group.');

select pg_temp.act_as('c0000000-0000-4000-8000-000000000002');
do $$ begin
  if (select count(*) from public.chat_messages where kind = 'text') <> 1 then raise exception 'Mark cannot see David''s message'; end if;
  if (select count(*) from public.chat_members) <> 4 then raise exception 'Mark should see the 4 men'; end if;
  perform public.chat_toggle_like((select id from public.chat_messages where kind = 'text'));
  if not exists (select 1 from public.chat_messages where kind = 'text' and 'c0000000-0000-4000-8000-000000000002'::uuid = any (liked_by)) then
    raise exception 'like not recorded';
  end if;
  perform public.chat_send('So proud of you, brother.', (select id from public.chat_messages where kind = 'text'));
  begin
    perform public.chat_delete_message((select id from public.chat_messages where body like 'Day 30%'));
    raise exception 'Mark deleted David''s message';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.act_as('c0000000-0000-4000-8000-000000000005');
do $$
declare
  men_msg uuid;
begin
  if (select count(*) from public.chat_messages where room = 'men-recovery') <> 0 then raise exception 'women see men''s group'; end if;
  if (select count(*) from public.chat_members) <> 1 then raise exception 'Ruth sees other groups'' members'; end if;
  reset role;
  select id into men_msg from public.chat_messages where body like 'Day 30%';
  set role authenticated;
  begin
    perform public.chat_toggle_like(men_msg);
    raise exception 'Ruth liked a men''s message';
  exception when raise_exception then
    if sqlerrm not like '%isn''t available%' then raise; end if;
  end;
  begin
    perform public.chat_send('hi', men_msg);
    raise exception 'Ruth replied into the men''s group';
  exception when raise_exception then
    if sqlerrm not like '%isn''t available%' then raise; end if;
  end;
  begin
    perform public.chat_report(men_msg, 'x');
    raise exception 'Ruth reported a men''s message';
  exception when raise_exception then
    if sqlerrm not like '%isn''t available%' then raise; end if;
  end;
end $$;

-- Three reports hide a message; moderators see the reports, members don't.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000002');
select public.chat_send('a message that will be reported');
do $$
declare
  msg uuid;
  reporter text;
begin
  select id into msg from public.chat_messages where body = 'a message that will be reported';
  foreach reporter in array array['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004'] loop
    perform pg_temp.act_as(reporter);
    perform public.chat_report(msg, 'not okay');
    perform public.chat_report(msg, 'twice is ignored');
  end loop;
  if (select deleted_at from public.chat_messages where id = msg) is null then raise exception 'three reports did not hide the message'; end if;
  if (select body from public.chat_messages where id = msg) <> '' then raise exception 'hidden message body still readable'; end if;
  perform pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
  if (select count(*) from public.chat_reports) <> 3 then raise exception 'moderator should see 3 reports'; end if;
  if (select body_snapshot from public.chat_reports limit 1) <> 'a message that will be reported' then raise exception 'snapshot missing'; end if;
  perform pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
  if (select count(*) from public.chat_reports) <> 0 then raise exception 'member can read reports'; end if;
end $$;

-- Moderator removes Mark: he loses access and can't rejoin.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
select public.chat_remove_member('c0000000-0000-4000-8000-000000000002', 'repeated violations');
select pg_temp.act_as('c0000000-0000-4000-8000-000000000002');
do $$ begin
  if (select count(*) from public.chat_messages) <> 0 then raise exception 'removed member can still read'; end if;
  if (select count(*) from public.chat_bans) <> 1 then raise exception 'removed member cannot see own removal'; end if;
  begin
    perform public.chat_join();
    raise exception 'removed member rejoined';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Non-moderators can't remove anyone.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
do $$ begin
  begin
    perform public.chat_remove_member('c0000000-0000-4000-8000-000000000003', '');
    raise exception 'member removed someone';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Changing the name style updates the name the group sees.
update public.profiles set name_display = 'nickname', nickname = 'Steady'
  where user_id = 'c0000000-0000-4000-8000-000000000001';
do $$ begin
  if (select display_name from public.chat_members where user_id = 'c0000000-0000-4000-8000-000000000001') <> 'Steady' then
    raise exception 'name change did not reach the group';
  end if;
end $$;

-- David deletes his own message; the text is gone for everyone.
do $$ begin
  perform public.chat_delete_message((select id from public.chat_messages where body like 'Day 30%'));
  if exists (select 1 from public.chat_messages where body like 'Day 30%') then raise exception 'deleted text still stored'; end if;
end $$;

-- Rate limit: at most 15 messages a minute.
do $$
declare
  sent int := 0;
begin
  for i in 1..20 loop
    begin
      perform public.chat_send('message ' || i);
      sent := sent + 1;
    exception when sqlstate '53400' then null;
    end;
  end loop;
  if sent > 15 then raise exception 'rate limit not enforced (% sent)', sent; end if;
end $$;

-- Blocks are private to the person who blocked.
insert into public.chat_blocks (blocked) values ('c0000000-0000-4000-8000-000000000003');
select pg_temp.act_as('c0000000-0000-4000-8000-000000000003');
do $$ begin
  if (select count(*) from public.chat_blocks) <> 0 then raise exception 'blocks visible to others'; end if;
end $$;

-- Luke switches to the women's track: he leaves the men's group automatically.
update public.profiles set gender = 'woman' where user_id = 'c0000000-0000-4000-8000-000000000003';
do $$ begin
  if (select count(*) from public.chat_messages where room = 'men-recovery') <> 0 then raise exception 'moved member still sees old group'; end if;
  if (select count(*) from public.chat_messages where room = 'women-recovery') <> 0 then raise exception 'moved member sees new group before joining'; end if;
end $$;

-- Push notifications: register this device, see who gets notified.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
select public.push_register('web', 'https://push.example.org/paul', 'BPAUL', 'apaul', true);
select pg_temp.act_as('c0000000-0000-4000-8000-000000000005');
select public.push_register('web', 'https://push.example.org/ruth', 'BRUTH', 'aruth', false);
do $$
declare
  msg uuid;
  n int;
begin
  -- Can't register a web endpoint without keys or https.
  begin
    perform public.push_register('web', 'http://push.example.org/x', 'k', 'a');
    raise exception 'insecure web endpoint accepted';
  exception when check_violation then null;
  end;
  -- Owners see only their own devices.
  if (select count(*) from public.push_subscriptions) <> 1 then raise exception 'push: should see only own device'; end if;
  -- Recipients can't be listed by app users.
  begin
    perform * from public.push_recipients(gen_random_uuid());
    raise exception 'push_recipients callable by app users';
  exception when insufficient_privilege then null;
  end;
  reset role;
  -- David's message in the men's group reaches Paul (a man in that group), not Ruth.
  select id into msg from public.chat_messages where room = 'men-recovery' and kind = 'text' and deleted_at is null limit 1;
  select count(*) into n from public.push_recipients(msg) r where r.endpoint = 'https://push.example.org/paul';
  if n <> 1 then raise exception 'push: Paul should be notified'; end if;
  select count(*) into n from public.push_recipients(msg) r where r.endpoint = 'https://push.example.org/ruth';
  if n <> 0 then raise exception 'push: Ruth must not be notified about the men''s group'; end if;
  -- Paul blocks the author: no more notifications from him.
  insert into public.chat_blocks (blocker, blocked)
    select 'c0000000-0000-4000-8000-000000000004', user_id from public.chat_messages where id = msg;
  select count(*) into n from public.push_recipients(msg);
  if n <> 0 then raise exception 'push: blocked author still notifies'; end if;
  -- The device moves to whoever registers it next.
  set role authenticated;
  perform pg_temp.act_as('c0000000-0000-4000-8000-000000000001');
  perform public.push_register('web', 'https://push.example.org/paul', 'BNEW', 'anew', false);
  reset role;
  if (select user_id from public.push_subscriptions where endpoint = 'https://push.example.org/paul') <> 'c0000000-0000-4000-8000-000000000001' then
    raise exception 'push: device did not move to the new account';
  end if;
  set role authenticated;
  perform public.push_unregister('https://push.example.org/paul');
  if exists (select 1 from public.push_subscriptions where endpoint = 'https://push.example.org/paul') then
    raise exception 'push: unregister failed';
  end if;
end $$;

-- A declined request can be made again; it waits for a leader again.
reset role;
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-000000000007', 'newcomer@example.com');
set role authenticated;
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
insert into public.profiles (track, gender, display_name) values ('spouse', 'woman', 'Joy');
select public.chat_join();
select pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
select public.leader_review_request('c0000000-0000-4000-8000-000000000007', false);
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
do $$ begin
  if (select status from public.chat_members where user_id = 'c0000000-0000-4000-8000-000000000007') <> 'declined' then
    raise exception 'decline not recorded';
  end if;
  if (select count(*) from public.chat_messages) <> 0 then raise exception 'declined person can read'; end if;
  if (public.chat_join()).status <> 'pending' then raise exception 'asking again should wait for a leader'; end if;
end $$;

-- Leaders: promote, step down, and always keep one.
select pg_temp.act_as('c0000000-0000-4000-8000-000000000004');
do $$ begin
  begin
    perform public.leader_set_leader('c0000000-0000-4000-8000-000000000004', false);
    raise exception 'the last leader stepped down';
  exception when raise_exception then
    if sqlerrm not like '%at least one leader%' then raise; end if;
  end;
  -- Making Joy a leader also lets her into her group.
  perform public.leader_set_leader('c0000000-0000-4000-8000-000000000007', true);
  if (select count(*) from public.leaders) <> 2 then raise exception 'promotion failed'; end if;
end $$;
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
do $$ begin
  if not public.is_leader() then raise exception 'Joy should be a leader'; end if;
  if (select status from public.chat_members where user_id = 'c0000000-0000-4000-8000-000000000007') <> 'active' then
    raise exception 'new leader should be in her group';
  end if;
  -- Leaders moderate their own group.
  if not public.i_moderate_chat() then raise exception 'leader should moderate her group'; end if;
  perform public.leader_set_leader('c0000000-0000-4000-8000-000000000004', false);
  if (select count(*) from public.leaders) <> 1 then raise exception 'step-down failed'; end if;
end $$;
select pg_temp.act_as('c0000000-0000-4000-8000-000000000006');
do $$ begin
  begin
    perform public.chat_remove_member('c0000000-0000-4000-8000-000000000007', '');
    raise exception 'a member removed a leader';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Signed-out (anon) callers can't use any of it.
reset role;
set role anon;
do $$ begin
  begin
    perform public.chat_join();
    raise exception 'anon could call chat_join';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Deleting an account removes its likes and messages.
reset role;
delete from auth.users where id = 'c0000000-0000-4000-8000-000000000002';
do $$ begin
  if exists (select 1 from public.chat_messages where 'c0000000-0000-4000-8000-000000000002'::uuid = any (liked_by)) then
    raise exception 'likes from a deleted account remain';
  end if;
  if exists (select 1 from public.chat_messages where user_id = 'c0000000-0000-4000-8000-000000000002') then
    raise exception 'messages from a deleted account remain';
  end if;
end $$;

\o
select 'Chat tests passed' as result;
