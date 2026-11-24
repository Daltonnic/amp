-- =============================================================================
-- Group chat (the "Group" tab) and how each person's name shows to others.
--
-- There are four groups. Each person can only ever see the one that matches
-- their profile:
--   men-recovery     a man working on his own recovery
--   women-recovery   a woman working on her own recovery
--   men-betrayed     a man whose wife betrayed him
--   women-betrayed   a woman whose husband betrayed her
--
-- Every write goes through a SECURITY DEFINER function below, so the rules
-- (right group, not removed, rate limits, moderators only for moderation) live
-- in one place. The app can only SELECT from the chat tables, and Row Level
-- Security limits that to the person's own group.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. How names show to others
-- ---------------------------------------------------------------------------
-- profiles.display_name is the person's first name (used for "Good morning,
-- David"). These columns add a last name and a choice of how the name shows
-- in the group.
alter table public.profiles
  add column last_name text not null default '' check (char_length(last_name) <= 80),
  add column name_display text not null default 'first_last_initial'
    check (name_display in ('first_last_initial', 'first', 'initials', 'full', 'nickname')),
  add column nickname text not null default '' check (char_length(nickname) <= 30);

-- The name other people see. Mirrors publicName() in src/lib/names.ts.
-- Returns null when the chosen style has nothing to show yet.
create function public.public_name(first_name text, last_name text, style text, nickname text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(case style
    when 'nickname' then btrim(nickname)
    when 'first' then btrim(first_name)
    when 'full' then btrim(first_name) || ' ' || btrim(last_name)
    when 'initials' then
      case when btrim(first_name) = '' then '' else upper(left(btrim(first_name), 1)) || '.' end ||
      case when btrim(last_name) = '' then '' else upper(left(btrim(last_name), 1)) || '.' end
    else -- first_last_initial
      btrim(first_name) ||
      case when btrim(last_name) = '' then '' else ' ' || upper(left(btrim(last_name), 1)) || '.' end
  end), '')
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.chat_rooms (
  id text primary key,
  name text not null,
  description text not null
);

insert into public.chat_rooms (id, name, description) values
  ('men-recovery', 'Men in Recovery', 'Men walking toward freedom together.'),
  ('women-recovery', 'Women in Recovery', 'Women walking toward freedom together.'),
  ('men-betrayed', 'Men Healing from Betrayal', 'Men finding steady ground after a spouse''s betrayal.'),
  ('women-betrayed', 'Women Healing from Betrayal', 'Women finding steady ground after a spouse''s betrayal.');

-- The group a profile belongs in, or null until we know man or woman.
create function public.chat_room_for(track text, gender text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case gender when 'man' then 'men' when 'woman' then 'women' end
      || case when track = 'spouse' then '-betrayed' else '-recovery' end
$$;

-- One row per person who has ever joined. Rows stay after leaving (left_at)
-- so names on old messages still show.
create table public.chat_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  room text not null references public.chat_rooms (id),
  display_name text not null check (char_length(display_name) between 1 and 170),
  role text not null default 'member' check (role in ('member', 'moderator')),
  joined_at timestamptz not null default now(),
  agreed_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  left_at timestamptz
);
create index chat_members_room_idx on public.chat_members (room);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null references public.chat_rooms (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'system' rows are "joined the group" / "left the group" notices.
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null check (char_length(body) <= 2000),
  reply_to uuid references public.chat_messages (id) on delete set null,
  liked_by uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index chat_messages_room_created_idx on public.chat_messages (room, created_at desc);
create index chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  room text not null references public.chat_rooms (id),
  author_id uuid not null references auth.users (id) on delete cascade,
  -- What the message said when it was reported, so moderators can review it
  -- even after it has been hidden.
  body_snapshot text not null,
  reporter uuid not null references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  unique (message_id, reporter)
);
create index chat_reports_room_open_idx on public.chat_reports (room, created_at desc) where resolved_at is null;

create table public.chat_bans (
  user_id uuid not null references auth.users (id) on delete cascade,
  room text not null references public.chat_rooms (id),
  banned_by uuid references auth.users (id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, room)
);

-- Blocking hides someone's messages from you, on every device.
create table public.chat_blocks (
  blocker uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- ---------------------------------------------------------------------------
-- 3. Who can see what
-- ---------------------------------------------------------------------------
-- The caller's group, but only while they are an active, not-removed member
-- of the group their profile says they belong in. SECURITY DEFINER so it can
-- read chat_members/chat_bans without tripping their own policies.
create function public.my_active_chat_room()
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
    and m.left_at is null
    and m.room = public.chat_room_for(p.track, p.gender)
    and not exists (select 1 from public.chat_bans b where b.user_id = m.user_id and b.room = m.room)
$$;

create function public.i_moderate_chat()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_members m
    where m.user_id = (select auth.uid())
      and m.role = 'moderator'
      and m.room = public.my_active_chat_room()
  )
$$;

alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;
alter table public.chat_bans enable row level security;
alter table public.chat_blocks enable row level security;

create policy "chat_rooms: signed-in users read" on public.chat_rooms
  for select to authenticated using (true);

create policy "chat_members: see your own row and your group" on public.chat_members
  for select to authenticated
  using (user_id = (select auth.uid()) or room = (select public.my_active_chat_room()));

create policy "chat_messages: members read their group" on public.chat_messages
  for select to authenticated
  using (room = (select public.my_active_chat_room()));

create policy "chat_reports: moderators read their group's reports" on public.chat_reports
  for select to authenticated
  using ((select public.i_moderate_chat()) and room = (select public.my_active_chat_room()));

create policy "chat_bans: see your own" on public.chat_bans
  for select to authenticated using (user_id = (select auth.uid()));

create policy "chat_blocks: owner can read" on public.chat_blocks
  for select to authenticated using (blocker = (select auth.uid()));
create policy "chat_blocks: owner can insert" on public.chat_blocks
  for insert to authenticated with check (blocker = (select auth.uid()));
create policy "chat_blocks: owner can delete" on public.chat_blocks
  for delete to authenticated using (blocker = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Actions (the only way to change chat data from the app)
-- ---------------------------------------------------------------------------
create function public.chat_join()
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

  insert into public.chat_members as m (user_id, room, display_name)
  values (uid, target, shown_name)
  on conflict (user_id) do update set
    room = excluded.room,
    display_name = excluded.display_name,
    agreed_at = now(),
    joined_at = case when m.room <> excluded.room or m.left_at is not null then now() else m.joined_at end,
    last_read_at = case when m.room <> excluded.room or m.left_at is not null then now() else m.last_read_at end,
    left_at = null
  returning * into result;

  if prior.user_id is null or prior.left_at is not null or prior.room <> target then
    insert into public.chat_messages (room, user_id, kind, body) values (target, uid, 'system', 'joined the group');
  end if;
  return result;
end;
$$;

create function public.chat_leave()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  left_room text;
begin
  update public.chat_members set left_at = now()
  where user_id = auth.uid() and left_at is null
  returning room into left_room;
  if left_room is not null then
    insert into public.chat_messages (room, user_id, kind, body)
    values (left_room, auth.uid(), 'system', 'left the group');
  end if;
end;
$$;

create function public.chat_send(body text, reply_to uuid default null)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_room text := public.my_active_chat_room();
  text_body text := btrim(coalesce(body, ''));
  result public.chat_messages;
begin
  if my_room is null then
    raise exception 'You''re not in a group right now.' using errcode = '42501';
  end if;
  if text_body = '' then
    raise exception 'Write a message first.';
  end if;
  if char_length(text_body) > 2000 then
    raise exception 'Messages can be up to 2,000 characters.';
  end if;
  if reply_to is not null and not exists (
    select 1 from public.chat_messages m
    where m.id = chat_send.reply_to and m.room = my_room and m.kind = 'text'
  ) then
    raise exception 'That message isn''t available to reply to.';
  end if;
  if (
    select count(*) from public.chat_messages m
    where m.user_id = uid and m.kind = 'text' and m.created_at > now() - interval '1 minute'
  ) >= 15 then
    raise exception 'You''re sending messages quickly. Please wait a moment.' using errcode = '53400';
  end if;

  insert into public.chat_messages (room, user_id, body, reply_to)
  values (my_room, uid, text_body, chat_send.reply_to)
  returning * into result;
  update public.chat_members set last_read_at = now() where user_id = uid;
  return result;
end;
$$;

create function public.chat_toggle_like(message_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_room text := public.my_active_chat_room();
  result uuid[];
begin
  if my_room is null then
    raise exception 'You''re not in a group right now.' using errcode = '42501';
  end if;
  update public.chat_messages m set liked_by =
    case when uid = any (m.liked_by) then array_remove(m.liked_by, uid) else array_append(m.liked_by, uid) end
  where m.id = message_id and m.room = my_room and m.kind = 'text' and m.deleted_at is null
  returning m.liked_by into result;
  if not found then
    raise exception 'That message isn''t available.';
  end if;
  return result;
end;
$$;

create function public.chat_delete_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_room text := public.my_active_chat_room();
begin
  if my_room is null then
    raise exception 'You''re not in a group right now.' using errcode = '42501';
  end if;
  update public.chat_messages m
  set body = '', liked_by = '{}', deleted_at = now(), deleted_by = uid
  where m.id = message_id and m.room = my_room and m.kind = 'text' and m.deleted_at is null
    and (m.user_id = uid or public.i_moderate_chat());
  if not found then
    raise exception 'You can only delete your own messages.' using errcode = '42501';
  end if;
  update public.chat_reports r set resolved_at = now(), resolved_by = uid
  where r.message_id = chat_delete_message.message_id and r.resolved_at is null;
end;
$$;

create function public.chat_mark_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.chat_members set last_read_at = now() where user_id = auth.uid() and left_at is null;
$$;

-- Three separate reports hide a message until a moderator reviews it.
create function public.chat_report(message_id uuid, reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_room text := public.my_active_chat_room();
  msg public.chat_messages;
begin
  if my_room is null then
    raise exception 'You''re not in a group right now.' using errcode = '42501';
  end if;
  select * into msg from public.chat_messages m
  where m.id = chat_report.message_id and m.room = my_room and m.kind = 'text';
  if not found then
    raise exception 'That message isn''t available.';
  end if;
  if msg.user_id = uid then
    raise exception 'You can delete your own message instead.';
  end if;
  insert into public.chat_reports (message_id, room, author_id, body_snapshot, reporter, reason)
  values (msg.id, my_room, msg.user_id, msg.body, uid, left(btrim(coalesce(reason, '')), 500))
  on conflict on constraint chat_reports_message_id_reporter_key do nothing;

  if msg.deleted_at is null and (
    select count(*) from public.chat_reports r where r.message_id = msg.id and r.resolved_at is null
  ) >= 3 then
    update public.chat_messages set body = '', liked_by = '{}', deleted_at = now(), deleted_by = null
    where id = msg.id;
  end if;
end;
$$;

-- Moderators: remove someone from the group (they can't rejoin it).
create function public.chat_remove_member(member_id uuid, reason text default '')
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
    raise exception 'Only moderators can remove people.' using errcode = '42501';
  end if;
  if member_id = uid then
    raise exception 'You can leave the group from Settings instead.';
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

create function public.chat_resolve_report(report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.i_moderate_chat() then
    raise exception 'Only moderators can review reports.' using errcode = '42501';
  end if;
  update public.chat_reports set resolved_at = now(), resolved_by = auth.uid()
  where id = report_id and room = public.my_active_chat_room() and resolved_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Keep membership in step with the profile
-- ---------------------------------------------------------------------------
-- A name change updates the name the group sees. Moving to a different group
-- (changing man/woman or track) leaves the old group.
create function public.chat_sync_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.chat_members;
begin
  select * into m from public.chat_members where user_id = new.user_id;
  if not found then
    return new;
  end if;
  update public.chat_members set display_name = coalesce(
    public.public_name(new.display_name, new.last_name, new.name_display, new.nickname),
    display_name
  )
  where user_id = new.user_id;
  if m.left_at is null and m.room is distinct from public.chat_room_for(new.track, new.gender) then
    update public.chat_members set left_at = now() where user_id = new.user_id;
    insert into public.chat_messages (room, user_id, kind, body)
    values (m.room, new.user_id, 'system', 'left the group');
  end if;
  return new;
end;
$$;

create trigger profiles_chat_sync
  after update of display_name, last_name, name_display, nickname, track, gender on public.profiles
  for each row execute function public.chat_sync_profile();

-- When an account is deleted, take its likes off other people's messages.
create function public.chat_forget_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_messages set liked_by = array_remove(liked_by, old.user_id)
  where old.user_id = any (liked_by);
  return old;
end;
$$;

create trigger chat_members_forget after delete on public.chat_members
  for each row execute function public.chat_forget_member();

-- ---------------------------------------------------------------------------
-- 6. Privileges
-- ---------------------------------------------------------------------------
grant select on public.chat_rooms, public.chat_members, public.chat_messages,
  public.chat_reports, public.chat_bans to authenticated;
grant select, insert, delete on public.chat_blocks to authenticated;
grant select, insert, update, delete on public.chat_rooms, public.chat_members, public.chat_messages,
  public.chat_reports, public.chat_bans, public.chat_blocks to service_role;

revoke execute on function
  public.public_name(text, text, text, text),
  public.chat_room_for(text, text),
  public.my_active_chat_room(),
  public.i_moderate_chat(),
  public.chat_join(),
  public.chat_leave(),
  public.chat_send(text, uuid),
  public.chat_toggle_like(uuid),
  public.chat_delete_message(uuid),
  public.chat_mark_read(),
  public.chat_report(uuid, text),
  public.chat_remove_member(uuid, text),
  public.chat_resolve_report(uuid),
  public.chat_sync_profile(),
  public.chat_forget_member()
from public, anon;

grant execute on function
  public.public_name(text, text, text, text),
  public.chat_room_for(text, text),
  public.my_active_chat_room(),
  public.i_moderate_chat(),
  public.chat_join(),
  public.chat_leave(),
  public.chat_send(text, uuid),
  public.chat_toggle_like(uuid),
  public.chat_delete_message(uuid),
  public.chat_mark_read(),
  public.chat_report(uuid, text),
  public.chat_remove_member(uuid, text),
  public.chat_resolve_report(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Live updates
-- ---------------------------------------------------------------------------
-- Supabase Realtime sends new and changed messages to each subscriber,
-- filtered by the SELECT policy above.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;
