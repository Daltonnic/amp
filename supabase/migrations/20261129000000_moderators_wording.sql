-- =============================================================================
-- Leaders are now called Moderators in the app (shown with a yellow shield).
-- Only the wording people see changes: messages from these functions,
-- notification text, and links (the page moved to /moderators; /leaders
-- still redirects). Table and function names stay as they are.
-- =============================================================================

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
    raise exception 'Only moderators can remove people.' using errcode = '42501';
  end if;
  if member_id = uid then
    raise exception 'You can leave the group from Settings instead.';
  end if;
  if exists (select 1 from public.leaders l where l.user_id = member_id) then
    raise exception 'Moderators can''t be removed from a group. Step them down as a moderator first.';
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


create or replace function public.leader_review_request(member_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_room text;
begin
  if not public.is_leader() then
    raise exception 'Only moderators can approve requests.' using errcode = '42501';
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


create or replace function public.leader_set_leader(member_id uuid, make boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_room text;
begin
  if not public.is_leader() then
    raise exception 'Only moderators can choose moderators.' using errcode = '42501';
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
      raise exception 'There must always be at least one moderator.';
    end if;
    delete from public.leaders where user_id = member_id;
  end if;
end;
$$;


create or replace function public.notifications_on_member()
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

  -- Asked to join: every moderator hears about it.
  if new.status = 'pending' and new.left_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'pending' or old.left_at is not null) then
    insert into public.notifications as n (user_id, kind, title, body, url, subject_user)
    select l.user_id, 'join_request', new.display_name || ' asked to join', room_name, '/moderators', new.user_id
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
    -- Other moderators see it was handled.
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
            'If you think this is a mistake, reach out to a moderator.', '/group');
  end if;
  return new;
end;
$$;


create or replace function public.notifications_on_leader()
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
    values (new.user_id, 'leader', 'You''re now a moderator',
            'You can approve people joining the groups, add meetings to the calendar, and help keep your group safe.',
            '/moderators');
  end if;
  -- Requests already waiting.
  insert into public.notifications (user_id, kind, title, body, url, subject_user, created_at)
  select new.user_id, 'join_request', m.display_name || ' asked to join', r.name, '/moderators', m.user_id,
         coalesce(m.requested_at, now())
  from public.chat_members m
  join public.chat_rooms r on r.id = m.room
  where m.status = 'pending' and m.left_at is null and m.user_id <> new.user_id
  on conflict (user_id, subject_user) where kind = 'join_request' do nothing;
  return new;
end;
$$;


-- Existing notifications follow suit.
update public.notifications set url = '/moderators' where url = '/leaders';
update public.notifications set title = 'You''re now a moderator' where kind = 'leader';
update public.notifications set body = 'If you think this is a mistake, reach out to a moderator.'
where kind = 'join_declined';
