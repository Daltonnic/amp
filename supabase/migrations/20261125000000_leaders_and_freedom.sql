-- =============================================================================
-- Leaders, join approvals, and the freedom counter.
--
-- Leaders:
--   * approve or decline requests to join a group (any group);
--   * make other people leaders (or step someone down, keeping at least one);
--   * moderate the group they belong to (delete messages, remove people,
--     review reports), like the per-group moderators before them;
--   * join their own group without waiting for approval.
-- Everyone else asks to join and waits for a leader. People who were already
-- in a group stay in it.
--
-- Freedom counter: the date someone's current stretch of freedom began, and
-- their longest stretch so far. Private to them (profiles are owner-only).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Freedom counter
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column freedom_start date,
  add column freedom_best_days integer not null default 0 check (freedom_best_days >= 0),
  add column freedom_hidden boolean not null default false;

-- ---------------------------------------------------------------------------
-- Leaders
-- ---------------------------------------------------------------------------
create table public.leaders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

alter table public.leaders enable row level security;
-- Who leads isn't secret: the app shows leaders in gold.
create policy "leaders: signed-in users can see who leads" on public.leaders
  for select to authenticated using (true);
grant select on public.leaders to authenticated;
grant select, insert, update, delete on public.leaders to service_role;

create function public.is_leader()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.leaders l where l.user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Join requests: a membership is pending until a leader approves it
-- ---------------------------------------------------------------------------
alter table public.chat_members
  add column status text not null default 'active' check (status in ('pending', 'active', 'declined')),
  add column requested_at timestamptz,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz;
create index chat_members_pending_idx on public.chat_members (requested_at) where status = 'pending';

-- Only approved members are in a group.
create or replace function public.my_active_chat_room()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.room
  from public.chat_members m
  join public.profiles p on p.user_id = m.user_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.left_at is null
    and m.room = public.chat_room_for(p.track, p.gender)
    and not exists (select 1 from public.chat_bans b where b.user_id = m.user_id and b.room = m.room)
$$;

-- Leaders moderate the group they're in (as do any per-group moderators).
create or replace function public.i_moderate_chat()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_active_chat_room() is not null and (
    public.is_leader()
    or exists (select 1 from public.chat_members m where m.user_id = auth.uid() and m.role = 'moderator')
  )
$$;

-- Members see approved members of their group (and always their own row).
drop policy "chat_members: see your own row and your group" on public.chat_members;
create policy "chat_members: see your own row and your group" on public.chat_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (room = (select public.my_active_chat_room()) and status = 'active'));

-- Joining: leaders (and people rejoining a group they were approved for) go
-- straight in; everyone else waits for a leader.
create or replace function public.chat_join()
returns public.chat_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  target text;
  shown_name text;
  prior public.chat_members;
  admit boolean;
  result public.chat_members;
begin
  if uid is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  select * into p from public.profiles where user_id = uid;
  if not found then
    raise exception 'Finish setting up your profile first.';
  end if;
  target := public.chat_room_for(p.track, p.gender);
  if target is null then
    raise exception 'Tell us whether you''re a man or a woman in Settings to join your group.';
  end if;
  shown_name := public.public_name(p.display_name, p.last_name, p.name_display, p.nickname);
  if shown_name is null then
    raise exception 'Add the name you want the group to see first.';
  end if;
  if exists (select 1 from public.chat_bans where user_id = uid and room = target) then
    raise exception 'You''ve been removed from this group.' using errcode = '42501';
  end if;

  select * into prior from public.chat_members where user_id = uid;
  if prior.user_id is not null and prior.room = target and prior.status = 'active' and prior.left_at is null then
    return prior; -- already in
  end if;
  if prior.user_id is not null and prior.room = target and prior.status = 'pending' then
    return prior; -- already waiting
  end if;
  admit := public.is_leader()
    or (prior.user_id is not null and prior.room = target and prior.status = 'active');

  insert into public.chat_members as m (user_id, room, display_name, status, requested_at)
  values (uid, target, shown_name, case when admit then 'active' else 'pending' end,
          case when admit then null else now() end)
  on conflict (user_id) do update set
    room = excluded.room,
    display_name = excluded.display_name,
    status = excluded.status,
    requested_at = excluded.requested_at,
    reviewed_by = null,
    reviewed_at = null,
    agreed_at = now(),
    joined_at = now(),
    last_read_at = now(),
    left_at = null
  returning * into result;

  if admit then
    insert into public.chat_messages (room, user_id, kind, body) values (target, uid, 'system', 'joined the group');
  end if;
  return result;
end;
$$;

-- Leaders can't be removed from a group by a moderator.
create or replace function public.chat_remove_member(member_id uuid, reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_room text := public.my_active_chat_room();
begin
  if not public.i_moderate_chat() then
    raise exception 'Only leaders can remove people.' using errcode = '42501';
  end if;
  if member_id = uid then
    raise exception 'You can leave the group from Settings instead.';
  end if;
  if exists (select 1 from public.leaders l where l.user_id = member_id) then
    raise exception 'Leaders can''t be removed from a group. Step them down as a leader first.';
  end if;
  if not exists (select 1 from public.chat_members m where m.user_id = member_id and m.room = my_room) then
    raise exception 'That person isn''t in this group.';
  end if;
  insert into public.chat_bans (user_id, room, banned_by, reason)
  values (member_id, my_room, uid, left(btrim(coalesce(reason, '')), 500))
  on conflict (user_id, room) do nothing;
  update public.chat_members set left_at = coalesce(left_at, now()) where user_id = member_id;
  update public.chat_reports set resolved_at = now(), resolved_by = uid
  where author_id = member_id and room = my_room and resolved_at is null;
  insert into public.chat_messages (room, user_id, kind, body)
  values (my_room, member_id, 'system', 'was removed from the group');
end;
$$;

-- Push only to approved members.
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
  join public.push_subscriptions s on s.user_id = cm.user_id
  where m.id = push_recipients.message_id
    and m.kind = 'text'
    and m.deleted_at is null
    and not exists (select 1 from public.chat_bans b where b.user_id = cm.user_id and b.room = m.room)
    and not exists (select 1 from public.chat_blocks k where k.blocker = cm.user_id and k.blocked = m.user_id)
$$;

-- ---------------------------------------------------------------------------
-- Leader actions
-- ---------------------------------------------------------------------------

-- Everyone with an account, for the Leaders page. Empty for non-leaders.
create function public.leader_people()
returns table (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  shown_name text,
  gender text,
  track text,
  room text,
  member_status text,
  requested_at timestamptz,
  joined_at timestamptz,
  is_leader boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    coalesce(p.display_name, ''),
    coalesce(p.last_name, ''),
    coalesce(m.display_name, public.public_name(p.display_name, p.last_name, p.name_display, p.nickname), ''),
    p.gender,
    p.track,
    public.chat_room_for(p.track, p.gender),
    case
      when m.user_id is null or m.room is distinct from public.chat_room_for(p.track, p.gender) then 'none'
      when exists (select 1 from public.chat_bans b where b.user_id = u.id and b.room = m.room) then 'removed'
      when m.status = 'active' and m.left_at is null then 'member'
      when m.status = 'active' then 'left'
      else m.status
    end,
    m.requested_at,
    m.joined_at,
    exists (select 1 from public.leaders l where l.user_id = u.id),
    u.created_at
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.chat_members m on m.user_id = u.id
  where public.is_leader()
  order by u.created_at desc
$$;

create function public.leader_review_request(member_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_room text;
begin
  if not public.is_leader() then
    raise exception 'Only leaders can approve requests.' using errcode = '42501';
  end if;
  update public.chat_members m set
    status = case when approve then 'active' else 'declined' end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    joined_at = case when approve then now() else m.joined_at end,
    last_read_at = case when approve then now() else m.last_read_at end,
    left_at = null
  where m.user_id = member_id and m.status = 'pending'
  returning m.room into joined_room;
  if joined_room is null then
    raise exception 'That request was already handled.';
  end if;
  if approve then
    insert into public.chat_messages (room, user_id, kind, body)
    values (joined_room, member_id, 'system', 'joined the group');
  end if;
end;
$$;

create function public.leader_set_leader(member_id uuid, make boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_room text;
begin
  if not public.is_leader() then
    raise exception 'Only leaders can change who leads.' using errcode = '42501';
  end if;
  if make then
    insert into public.leaders (user_id, granted_by) values (member_id, auth.uid())
    on conflict (user_id) do nothing;
    -- A new leader who was waiting to join their group goes straight in.
    update public.chat_members m set status = 'active', reviewed_by = auth.uid(), reviewed_at = now(),
      joined_at = now(), last_read_at = now(), left_at = null
    where m.user_id = member_id and m.status = 'pending'
    returning m.room into joined_room;
    if joined_room is not null then
      insert into public.chat_messages (room, user_id, kind, body)
      values (joined_room, member_id, 'system', 'joined the group');
    end if;
  else
    if (select count(*) from public.leaders) <= 1 then
      raise exception 'There must always be at least one leader.';
    end if;
    delete from public.leaders where user_id = member_id;
  end if;
end;
$$;

revoke execute on function
  public.is_leader(),
  public.leader_people(),
  public.leader_review_request(uuid, boolean),
  public.leader_set_leader(uuid, boolean)
from public, anon;
grant execute on function
  public.is_leader(),
  public.leader_people(),
  public.leader_review_request(uuid, boolean),
  public.leader_set_leader(uuid, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications for join requests and approvals
-- ---------------------------------------------------------------------------
-- Posts an event to the notify-group function (same setup as group messages).
create function public.push_webhook(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text;
  secret text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into target using 'push_webhook_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into secret using 'push_webhook_secret';
  if target is null or secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
    using target, payload,
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret);
exception when others then
  raise warning 'push_webhook: %', sqlerrm;
end;
$$;

create or replace function public.chat_notify_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'text' then
    perform public.push_webhook(jsonb_build_object('message_id', new.id));
  end if;
  return new;
end;
$$;

-- New request → tell the leaders. Approved → tell the person.
create function public.chat_members_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.push_webhook(jsonb_build_object('event', 'join_request', 'user_id', new.user_id));
  elsif tg_op = 'UPDATE' and new.status = 'active' and old.status = 'pending' then
    perform public.push_webhook(jsonb_build_object('event', 'join_approved', 'user_id', new.user_id));
  end if;
  return new;
end;
$$;

create trigger chat_members_push
  after insert or update of status on public.chat_members
  for each row execute function public.chat_members_notify();

revoke execute on function public.push_webhook(jsonb), public.chat_members_notify() from public, anon, authenticated;
