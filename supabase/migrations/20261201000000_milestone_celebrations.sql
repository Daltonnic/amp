-- =============================================================================
-- Milestone celebrations.
--
-- When someone in recovery reaches a freedom milestone (1, 3, 7, 14, 21, 30,
-- 60, 90, 120, 180, 270 days, then every year), the app celebrates it once,
-- and they can choose to share it with their group. A shared milestone is a
-- special message ("Sam M. reached 30 days of freedom") that members can
-- celebrate (like) and reply to, and it notifies the group like a message.
--
-- The server checks the milestone is real (from the person's own start date)
-- and only shares each milestone once per stretch of freedom.
-- =============================================================================

-- Milestone messages.
alter table public.chat_messages
  drop constraint chat_messages_kind_check,
  add constraint chat_messages_kind_check check (kind in ('text', 'system', 'milestone')),
  add column milestone_days integer check (milestone_days is null or milestone_days > 0),
  add constraint chat_messages_milestone_days check ((kind = 'milestone') = (milestone_days is not null));

-- Which milestone the app last celebrated, and last shared, for the current
-- stretch. A new stretch (a changed start date) starts both over.
alter table public.profiles
  add column freedom_celebrated integer not null default 0 check (freedom_celebrated >= 0),
  add column freedom_shared integer not null default 0 check (freedom_shared >= 0);

create function public.profiles_new_stretch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.freedom_start is distinct from old.freedom_start then
    if new.freedom_celebrated = old.freedom_celebrated then new.freedom_celebrated := 0; end if;
    if new.freedom_shared = old.freedom_shared then new.freedom_shared := 0; end if;
  end if;
  return new;
end;
$$;
create trigger profiles_new_stretch
  before update of freedom_start on public.profiles
  for each row execute function public.profiles_new_stretch();

-- The same milestones as src/lib/freedom.ts.
create function public.is_freedom_milestone(days integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select days = any (array[1, 3, 7, 14, 21, 30, 60, 90, 120, 180, 270, 365]) or (days > 365 and days % 365 = 0)
$$;

-- "1 day", "30 days", "1 year", "2 years".
create function public.freedom_duration_label(days integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when days >= 365 and days % 365 = 0 then
      (days / 365)::text || case when days / 365 = 1 then ' year' else ' years' end
    else days::text || case when days = 1 then ' day' else ' days' end
  end
$$;

-- Share a milestone with your group.
create function public.chat_share_milestone(days integer)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_room text := public.my_active_chat_room();
  p public.profiles;
  reached integer;
  result public.chat_messages;
begin
  if my_room is null then
    raise exception 'Join your group to share milestones.' using errcode = '42501';
  end if;
  select * into p from public.profiles where user_id = uid;
  if p.user_id is null or p.track <> 'men' or p.freedom_start is null then
    raise exception 'There''s no freedom counter to share.';
  end if;
  if days is null or not public.is_freedom_milestone(days) then
    raise exception 'That isn''t a milestone.';
  end if;
  -- Days from their start date to today where they are (a day of slack for
  -- time zones, matching the app's own count).
  reached := (now() at time zone coalesce(p.timezone, 'UTC'))::date - p.freedom_start;
  if reached + 1 < days then
    raise exception 'That milestone hasn''t been reached yet.';
  end if;
  if exists (
    select 1 from public.chat_messages m
    where m.user_id = uid and m.kind = 'milestone' and m.milestone_days = days and m.deleted_at is null
      and m.created_at >= p.freedom_start::timestamp at time zone 'UTC' - interval '1 day'
  ) then
    raise exception 'You already shared this milestone.';
  end if;

  insert into public.chat_messages (room, user_id, kind, body, milestone_days)
  values (my_room, uid, 'milestone', 'reached ' || public.freedom_duration_label(days) || ' of freedom', days)
  returning * into result;
  update public.profiles set
    freedom_shared = greatest(freedom_shared, days),
    freedom_celebrated = greatest(freedom_celebrated, days)
  where user_id = uid;
  update public.chat_members set last_read_at = now() where user_id = uid;
  return result;
end;
$$;
revoke execute on function public.chat_share_milestone(integer) from public, anon;
grant execute on function public.chat_share_milestone(integer) to authenticated;
revoke execute on function public.is_freedom_milestone(integer), public.freedom_duration_label(integer) from public, anon;
grant execute on function public.is_freedom_milestone(integer), public.freedom_duration_label(integer) to authenticated;

-- Milestones can be celebrated (liked), replied to, deleted and pushed like messages.
create or replace function public.chat_send(body text, reply_to uuid default null)
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
    where m.id = chat_send.reply_to and m.room = my_room and m.kind in ('text', 'milestone')
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

create or replace function public.chat_toggle_like(message_id uuid)
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
  where m.id = message_id and m.room = my_room and m.kind in ('text', 'milestone') and m.deleted_at is null
  returning m.liked_by into result;
  if not found then
    raise exception 'That message isn''t available.';
  end if;
  return result;
end;
$$;

create or replace function public.chat_delete_message(message_id uuid)
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
  where m.id = message_id and m.room = my_room and m.kind in ('text', 'milestone') and m.deleted_at is null
    and (m.user_id = uid or public.i_moderate_chat());
  if not found then
    raise exception 'You can only delete your own messages.' using errcode = '42501';
  end if;
  update public.chat_reports r set resolved_at = now(), resolved_by = uid
  where r.message_id = chat_delete_message.message_id and r.resolved_at is null;
end;
$$;

create or replace function public.chat_notify_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind in ('text', 'milestone') then
    perform public.push_webhook(jsonb_build_object('message_id', new.id));
  end if;
  return new;
end;
$$;

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
  join public.push_subscriptions s on s.user_id = cm.user_id and s.notify_messages
  where m.id = push_recipients.message_id
    and m.kind in ('text', 'milestone')
    and m.deleted_at is null
    and not exists (select 1 from public.chat_bans b where b.user_id = cm.user_id and b.room = m.room)
    and not exists (select 1 from public.chat_blocks k where k.blocker = cm.user_id and k.blocked = m.user_id)
$$;
