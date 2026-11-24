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

-- Everyone joins their own group.
do $$
declare
  m public.chat_members;
  ids text[] := array['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
                      'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004',
                      'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006'];
  rooms text[] := array['men-recovery', 'men-recovery', 'men-recovery', 'men-recovery', 'women-recovery', 'women-betrayed'];
begin
  for i in 1..6 loop
    perform pg_temp.act_as(ids[i]);
    m := public.chat_join();
    if m.room <> rooms[i] then raise exception 'joined % instead of %', m.room, rooms[i]; end if;
  end loop;
  perform pg_temp.act_as(ids[1]);
  if (select display_name from public.chat_members where user_id = ids[1]::uuid) <> 'David M.' then
    raise exception 'display name not derived from profile';
  end if;
end $$;

-- Make Paul a moderator (done with SQL, never from the app).
reset role;
update public.chat_members set role = 'moderator' where user_id = 'c0000000-0000-4000-8000-000000000004';
set role authenticated;

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
