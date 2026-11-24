-- =============================================================================
-- Notifications: a place in the app to see your notifications.
--
-- The database writes these as things happen, whether or not someone turned
-- on push notifications:
--   reply          someone replied to your group message
--   join_request   (leaders) someone asked to join a group
--   join_handled   (leaders) that request was approved or declined
--   join_approved  you're in your group
--   join_declined  your request to join wasn't approved
--   leader         you were made a leader
--   meeting        a meeting reminder: one per meeting date, brought back to
--                  the top (unread) at each reminder
-- Group messages themselves aren't copied here; the app shows how many are
-- unread instead.
--
-- People only see and remove their own. Kept for 90 days.
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'reply', 'join_request', 'join_handled', 'join_approved', 'join_declined', 'leader', 'meeting'
  )),
  title text not null check (char_length(title) <= 300),
  body text not null default '' check (char_length(body) <= 300),
  -- Where tapping it goes: always a path inside the app.
  url text not null default '/home' check (url like '/%' and url not like '//%'),
  -- What it's about, so it changes or goes away with it.
  message_id uuid references public.chat_messages (id) on delete cascade,
  event_id uuid references public.calendar_events (id) on delete cascade,
  occurrence_start timestamptz,
  subject_user uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_message_idx on public.notifications (message_id) where message_id is not null;
create index notifications_event_idx on public.notifications (event_id) where event_id is not null;
create index notifications_subject_idx on public.notifications (subject_user) where subject_user is not null;
create unique index notifications_meeting_once
  on public.notifications (user_id, event_id, occurrence_start) where kind = 'meeting';
create unique index notifications_request_once
  on public.notifications (user_id, subject_user) where kind = 'join_request';

alter table public.notifications enable row level security;
create policy "notifications: see your own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: remove your own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

-- Live updates in the app (the badge on the bell).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- Marks your notifications read: all of them, the given ones, or the given kinds.
create function public.notifications_mark_read(ids uuid[] default null, kinds text[] default null)
returns integer
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.notifications n set read_at = now()
    where n.user_id = auth.uid()
      and n.read_at is null
      and (notifications_mark_read.ids is null or n.id = any (notifications_mark_read.ids))
      and (notifications_mark_read.kinds is null or n.kind = any (notifications_mark_read.kinds))
    returning 1
  )
  select count(*)::integer from done
$$;
revoke execute on function public.notifications_mark_read(uuid[], text[]) from public, anon;
grant execute on function public.notifications_mark_read(uuid[], text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Replies
-- ---------------------------------------------------------------------------
create function public.notifications_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_author uuid;
  shown text;
begin
  if tg_op = 'UPDATE' then
    -- A deleted or hidden message takes its notifications with it.
    if new.deleted_at is not null and old.deleted_at is null then
      delete from public.notifications n where n.message_id = new.id;
    end if;
    return new;
  end if;

  if new.kind <> 'text' or new.reply_to is null then
    return new;
  end if;
  select m.user_id into parent_author
  from public.chat_messages m
  where m.id = new.reply_to and m.deleted_at is null;
  if parent_author is null or parent_author = new.user_id then
    return new;
  end if;
  -- Only someone still in the group, who hasn't blocked the person replying.
  if not exists (
    select 1 from public.chat_members cm
    where cm.user_id = parent_author and cm.room = new.room and cm.status = 'active' and cm.left_at is null
  ) or exists (
    select 1 from public.chat_blocks b where b.blocker = parent_author and b.blocked = new.user_id
  ) then
    return new;
  end if;
  select cm.display_name into shown from public.chat_members cm where cm.user_id = new.user_id;
  insert into public.notifications (user_id, kind, title, body, url, message_id, subject_user)
  values (parent_author, 'reply', coalesce(shown, 'Someone') || ' replied to you',
          left(new.body, 140), '/group', new.id, new.user_id);
  return new;
end;
$$;
create trigger chat_messages_notifications
  after insert or update of deleted_at on public.chat_messages
  for each row execute function public.notifications_on_message();

-- ---------------------------------------------------------------------------
-- Join requests, approvals and declines
-- ---------------------------------------------------------------------------
create function public.notifications_on_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications n where n.subject_user = old.user_id and n.kind = 'join_request';
    return old;
  end if;

  select r.name into room_name from public.chat_rooms r where r.id = new.room;

  -- Asked to join: every leader hears about it.
  if new.status = 'pending' and new.left_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'pending' or old.left_at is not null) then
    insert into public.notifications as n (user_id, kind, title, body, url, subject_user)
    select l.user_id, 'join_request', new.display_name || ' asked to join', room_name, '/leaders', new.user_id
    from public.leaders l
    where l.user_id <> new.user_id
    on conflict (user_id, subject_user) where kind = 'join_request' do update set
      title = excluded.title,
      body = excluded.body,
      created_at = now(),
      read_at = null;
    return new;
  end if;

  if tg_op <> 'UPDATE' or old.status <> 'pending' or old.left_at is not null then
    return new;
  end if;

  if new.status = 'pending' and new.left_at is not null then
    -- They withdrew their request.
    delete from public.notifications n where n.subject_user = new.user_id and n.kind = 'join_request';
  elsif new.status = 'active' then
    -- Other leaders see it was handled.
    update public.notifications n set
      kind = 'join_handled',
      title = new.display_name || ' joined ' || room_name,
      body = 'Request approved',
      read_at = coalesce(n.read_at, now())
    where n.subject_user = new.user_id and n.kind = 'join_request';
    insert into public.notifications (user_id, kind, title, body, url)
    values (new.user_id, 'join_approved', 'You''re in! Welcome to ' || room_name,
            'Your request was approved. Say hello to the group.', '/group');
  elsif new.status = 'declined' then
    update public.notifications n set
      kind = 'join_handled',
      title = new.display_name || ' wasn''t added to ' || room_name,
      body = 'Request declined',
      read_at = coalesce(n.read_at, now())
    where n.subject_user = new.user_id and n.kind = 'join_request';
    insert into public.notifications (user_id, kind, title, body, url)
    values (new.user_id, 'join_declined', 'Your request to join ' || room_name || ' wasn''t approved',
            'If you think this is a mistake, reach out to a leader.', '/group');
  end if;
  return new;
end;
$$;
create trigger chat_members_notifications
  after insert or update of status, left_at or delete on public.chat_members
  for each row execute function public.notifications_on_member();

-- ---------------------------------------------------------------------------
-- New leaders
-- ---------------------------------------------------------------------------
create function public.notifications_on_leader()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.notifications n
    where n.user_id = old.user_id and n.kind in ('join_request', 'join_handled');
    return old;
  end if;
  if new.granted_by is distinct from new.user_id then
    insert into public.notifications (user_id, kind, title, body, url)
    values (new.user_id, 'leader', 'You''re now a leader',
            'You can approve people joining the groups, add meetings to the calendar, and help keep your group safe.',
            '/leaders');
  end if;
  -- Requests already waiting.
  insert into public.notifications (user_id, kind, title, body, url, subject_user, created_at)
  select new.user_id, 'join_request', m.display_name || ' asked to join', r.name, '/leaders', m.user_id,
         coalesce(m.requested_at, now())
  from public.chat_members m
  join public.chat_rooms r on r.id = m.room
  where m.status = 'pending' and m.left_at is null and m.user_id <> new.user_id
  on conflict (user_id, subject_user) where kind = 'join_request' do nothing;
  return new;
end;
$$;
create trigger leaders_notifications
  after insert or delete on public.leaders
  for each row execute function public.notifications_on_leader();

-- ---------------------------------------------------------------------------
-- Meeting reminders: the every-minute scheduler also writes them here, for
-- everyone in the meeting's groups (except anyone who said they can't make it).
-- ---------------------------------------------------------------------------
create or replace function public.calendar_send_due_reminders()
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
      insert into public.notifications as n (user_id, kind, title, url, event_id, occurrence_start)
      select p.user_id, 'meeting', left(e.title, 300),
             '/calendar?event=' || e.id || '&at=' || (extract(epoch from rec.starts_at) * 1000)::bigint,
             e.id, rec.starts_at
      from public.calendar_events e
      join public.profiles p on public.chat_room_for(p.track, p.gender) = any (e.rooms)
      where e.id = rec.event_id
        and not exists (
          select 1 from public.calendar_rsvps v
          where v.event_id = e.id and v.user_id = p.user_id
            and v.occurrence_start = rec.starts_at and v.response = 'no'
        )
      on conflict (user_id, event_id, occurrence_start) where kind = 'meeting' do update set
        title = excluded.title,
        url = excluded.url,
        created_at = now(),
        read_at = null;
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

-- Saying you can't make it clears that date's reminder from your notifications.
create function public.notifications_on_rsvp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.response = 'no' then
    delete from public.notifications n
    where n.user_id = new.user_id and n.kind = 'meeting'
      and n.event_id = new.event_id and n.occurrence_start = new.occurrence_start;
  end if;
  return new;
end;
$$;
create trigger calendar_rsvps_notifications
  after insert or update of response on public.calendar_rsvps
  for each row execute function public.notifications_on_rsvp();

-- ---------------------------------------------------------------------------
-- Keep 90 days
-- ---------------------------------------------------------------------------
create function public.notifications_prune()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.notifications where created_at < now() - interval '90 days' returning 1
  )
  select count(*)::integer from gone
$$;
revoke execute on function public.notifications_prune() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('notifications-prune', '17 9 * * *', 'select public.notifications_prune()');
  end if;
end;
$$;

revoke execute on function
  public.notifications_on_message(),
  public.notifications_on_member(),
  public.notifications_on_leader(),
  public.notifications_on_rsvp()
from public, anon, authenticated;
