-- Leaders see only the name each person chose to show their group — never
-- their email or real first/last name. The Leaders page reads everything it
-- shows from this function, so leaving those columns out means they never
-- reach a leader's device.
drop function public.leader_people();

create function public.leader_people()
returns table (
  user_id uuid,
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

revoke execute on function public.leader_people() from public, anon;
grant execute on function public.leader_people() to authenticated;
