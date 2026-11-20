-- RLS assertions. Run by supabase/tests/run.sh after the migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');
insert into public.library_articles (title, content, category) values ('Hello', 'Body', 'recovery');
insert into public.library_articles (title, content, category, published) values ('Draft', 'Body', 'recovery', false);

-- User A writes their own data.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.profiles (track) values ('men');
insert into public.journal_entries (content) values ('private thoughts');
insert into public.check_ins (track, date, emotional_state) values ('men', current_date, 'Hopeful');

-- User B cannot see or modify A's data.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if (select count(*) from public.journal_entries) <> 0 then raise exception 'RLS leak: B can read A journal'; end if;
  if (select count(*) from public.profiles) <> 0 then raise exception 'RLS leak: B can read A profile'; end if;
  update public.journal_entries set content = 'hacked';
  delete from public.check_ins;
  if (select count(*) from public.library_articles) <> 1 then raise exception 'library: expected only the published article'; end if;
end $$;

-- B cannot insert a row owned by A.
do $$ begin
  begin
    insert into public.journal_entries (user_id, content) values ('11111111-1111-1111-1111-111111111111', 'spoof');
    raise exception 'RLS hole: B inserted a row for A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.library_articles (title, content, category) values ('x', 'y', 'recovery');
    raise exception 'RLS hole: user wrote to library';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Anonymous role sees nothing.
reset role;
set role anon;
do $$ begin
  begin
    perform count(*) from public.journal_entries;
    raise exception 'anon can read journal_entries';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The Edge Functions' service role can write rate-limit logs.
reset role;
set role service_role;
insert into public.outbound_emails (user_id, kind) values ('11111111-1111-1111-1111-111111111111', 'support');
insert into public.ai_usage (user_id) values ('11111111-1111-1111-1111-111111111111');
reset role;

-- A's data is intact; deleting A's auth user cascades everything.
do $$ begin
  if (select content from public.journal_entries) <> 'private thoughts' then raise exception 'A journal was modified by B'; end if;
  if (select count(*) from public.check_ins) <> 1 then raise exception 'A check-in was deleted by B'; end if;
end $$;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if (select count(*) from public.journal_entries) + (select count(*) from public.profiles) + (select count(*) from public.check_ins)
     + (select count(*) from public.outbound_emails) + (select count(*) from public.ai_usage) <> 0
    then raise exception 'account deletion did not cascade'; end if;
end $$;
select 'RLS tests passed' as result;
