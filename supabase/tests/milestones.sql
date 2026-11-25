-- Milestone celebration assertions. Run by supabase/tests/run.sh last.
-- Joy (c…07) is a moderator. New here: Finn and Gus, men in recovery, and
-- Hal, who isn't in a group.
\set ON_ERROR_STOP on
\pset tuples_only on
\o /dev/null
reset role;
create function pg_temp.act_as(uid text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', uid, false) $$;
-- Runs a statement and returns its error message ('' if it worked).
create function pg_temp.err(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return '';
exception when others then
  return sqlerrm;
end $$;

do $$ begin
  if not public.is_freedom_milestone(30) or not public.is_freedom_milestone(730) then raise exception 'milestones'; end if;
  if public.is_freedom_milestone(31) or public.is_freedom_milestone(400) then raise exception 'not milestones'; end if;
  if public.freedom_duration_label(1) <> '1 day' or public.freedom_duration_label(30) <> '30 days'
     or public.freedom_duration_label(365) <> '1 year' or public.freedom_duration_label(730) <> '2 years' then
    raise exception 'labels';
  end if;
end $$;

insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-000000000001', 'finn@example.com'),
  ('f0000000-0000-4000-8000-000000000002', 'gus@example.com'),
  ('f0000000-0000-4000-8000-000000000003', 'hal@example.com');

set role authenticated;
select pg_temp.act_as('f0000000-0000-4000-8000-000000000001');
insert into public.profiles (track, gender, display_name, last_name, freedom_start)
values ('men', 'man', 'Finn', 'Shaw', current_date - 30);
select public.chat_join();
select pg_temp.act_as('f0000000-0000-4000-8000-000000000002');
insert into public.profiles (track, gender, display_name) values ('men', 'man', 'Gus');
select public.chat_join();
select pg_temp.act_as('f0000000-0000-4000-8000-000000000003');
insert into public.profiles (track, gender, display_name, freedom_start) values ('men', 'man', 'Hal', current_date - 30);
select pg_temp.act_as('c0000000-0000-4000-8000-000000000007');
select public.leader_review_request('f0000000-0000-4000-8000-000000000001', true);
select public.leader_review_request('f0000000-0000-4000-8000-000000000002', true);

-- Finn shares 30 days.
select pg_temp.act_as('f0000000-0000-4000-8000-000000000001');
select public.chat_share_milestone(30);
do $$
declare
  m public.chat_messages;
begin
  select * into m from public.chat_messages where kind = 'milestone' and user_id = auth.uid();
  if m.body <> 'reached 30 days of freedom' or m.milestone_days <> 30 or m.room <> 'men-recovery' then
    raise exception 'milestone message: % % %', m.body, m.milestone_days, m.room;
  end if;
  if (select freedom_shared from public.profiles where user_id = auth.uid()) <> 30
     or (select freedom_celebrated from public.profiles where user_id = auth.uid()) <> 30 then
    raise exception 'profile should remember the shared milestone';
  end if;
  -- Once per stretch; only real, reached milestones.
  if pg_temp.err('select public.chat_share_milestone(30)') not like '%already shared%' then raise exception 'shared twice'; end if;
  if pg_temp.err('select public.chat_share_milestone(60)') not like '%hasn''t been reached%' then raise exception 'shared early'; end if;
  if pg_temp.err('select public.chat_share_milestone(31)') not like '%isn''t a milestone%' then raise exception 'not a milestone'; end if;
  if pg_temp.err('select public.chat_share_milestone(null)') not like '%isn''t a milestone%' then raise exception 'null days'; end if;
  -- Nobody posts a milestone message directly.
  begin
    insert into public.chat_messages (room, user_id, kind, body, milestone_days)
    values ('men-recovery', auth.uid(), 'milestone', 'reached 365 days of freedom', 365);
    raise exception 'a milestone was inserted directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Gus (no counter) can't share, but can celebrate and encourage Finn.
select pg_temp.act_as('f0000000-0000-4000-8000-000000000002');
do $$
declare
  ms uuid := (select id from public.chat_messages where kind = 'milestone' and user_id = 'f0000000-0000-4000-8000-000000000001');
begin
  if pg_temp.err('select public.chat_share_milestone(1)') not like '%no freedom counter%' then raise exception 'no counter'; end if;
  if not ('f0000000-0000-4000-8000-000000000002' = any (public.chat_toggle_like(ms))) then raise exception 'celebrate'; end if;
  perform public.chat_send('So proud of you, brother!', ms);
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notifications where user_id = 'f0000000-0000-4000-8000-000000000001'
                 and kind = 'reply' and title = 'Gus replied to you') then
    raise exception 'Finn should hear about the encouragement';
  end if;
end $$;

-- Hal isn't in a group.
set role authenticated;
select pg_temp.act_as('f0000000-0000-4000-8000-000000000003');
do $$ begin
  begin
    perform public.chat_share_milestone(30);
    raise exception 'shared without a group';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Finn deletes it, and may share it again; a new stretch starts over.
select pg_temp.act_as('f0000000-0000-4000-8000-000000000001');
do $$ begin
  perform public.chat_delete_message((select id from public.chat_messages where kind = 'milestone' and user_id = auth.uid()));
  perform public.chat_share_milestone(30);
  if (select count(*) from public.chat_messages where kind = 'milestone' and user_id = auth.uid() and deleted_at is null) <> 1 then
    raise exception 'share after delete';
  end if;
  update public.profiles set freedom_start = current_date where user_id = auth.uid();
  if (select freedom_shared + freedom_celebrated from public.profiles where user_id = auth.uid()) <> 0 then
    raise exception 'a new stretch should start over';
  end if;
  if pg_temp.err('select public.chat_share_milestone(30)') not like '%hasn''t been reached%' then raise exception 'new stretch'; end if;
  -- Celebrating (without sharing) is remembered.
  update public.profiles set freedom_celebrated = 7 where user_id = auth.uid();
  if (select freedom_celebrated from public.profiles where user_id = auth.uid()) <> 7 then raise exception 'celebrated'; end if;
end $$;
reset role;

\o
select 'Milestone tests passed' as result;
