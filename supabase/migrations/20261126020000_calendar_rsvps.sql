-- =============================================================================
-- RSVPs for meetings: "Going" or "Can't make it", per date of a meeting.
--
-- * Anyone who can see a meeting can answer for a date that hasn't ended.
-- * Everyone sees how many are going; leaders also see who (by the name each
--   person chose to show, never email).
-- * People who can't make it aren't sent reminders for that date.
-- =============================================================================

create table public.calendar_rsvps (
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  occurrence_start timestamptz not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  response text not null check (response in ('yes', 'no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, occurrence_start, user_id)
);
create index calendar_rsvps_user_idx on public.calendar_rsvps (user_id);

alter table public.calendar_rsvps enable row level security;
create policy "calendar_rsvps: see your own" on public.calendar_rsvps
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.calendar_rsvps to authenticated;
grant select, insert, update, delete on public.calendar_rsvps to service_role;

-- Whether the caller can see an event (their section's, or any for leaders).
create function public.calendar_can_see(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendar_events e
    where e.id = calendar_can_see.event_id
      and (public.is_leader() or e.rooms && array[public.my_profile_room()])
  )
$$;

-- Answer for one date of a meeting. `response` null clears the answer.
create function public.calendar_rsvp(event_id uuid, occurrence_start timestamptz, response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ends timestamptz;
begin
  if uid is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  if not public.calendar_can_see(calendar_rsvp.event_id) then
    raise exception 'That meeting isn''t available.' using errcode = '42501';
  end if;
  if calendar_rsvp.response is null or calendar_rsvp.response = '' then
    delete from public.calendar_rsvps r
    where r.event_id = calendar_rsvp.event_id and r.occurrence_start = calendar_rsvp.occurrence_start
      and r.user_id = uid;
    return;
  end if;
  if calendar_rsvp.response not in ('yes', 'no') then
    raise exception 'Answer going or can''t make it.';
  end if;
  select o.ends_at into ends
  from public.calendar_occurrences(calendar_rsvp.occurrence_start - interval '1 minute',
                                   calendar_rsvp.occurrence_start + interval '1 minute') o
  where o.event_id = calendar_rsvp.event_id and o.starts_at = calendar_rsvp.occurrence_start;
  if ends is null then
    raise exception 'That meeting time doesn''t exist.';
  end if;
  if ends < now() then
    raise exception 'That meeting has already happened.';
  end if;
  insert into public.calendar_rsvps as r (event_id, occurrence_start, user_id, response)
  values (calendar_rsvp.event_id, calendar_rsvp.occurrence_start, uid, calendar_rsvp.response)
  on conflict on constraint calendar_rsvps_pkey do update set
    response = excluded.response,
    updated_at = now();
end;
$$;

-- Counts (and your own answer) for the meetings you can see in a range.
create function public.calendar_rsvp_summary(range_start timestamptz, range_end timestamptz)
returns table (event_id uuid, occurrence_start timestamptz, going integer, not_going integer, mine text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.event_id,
    r.occurrence_start,
    (count(*) filter (where r.response = 'yes'))::integer,
    (count(*) filter (where r.response = 'no'))::integer,
    max(r.response) filter (where r.user_id = auth.uid())
  from public.calendar_rsvps r
  join public.calendar_events e on e.id = r.event_id
  where r.occurrence_start >= calendar_rsvp_summary.range_start - interval '1 day'
    and r.occurrence_start < calendar_rsvp_summary.range_end
    and (public.is_leader() or e.rooms && array[public.my_profile_room()])
  group by r.event_id, r.occurrence_start
$$;

-- Leaders: who answered for one date (chosen names only).
create function public.calendar_rsvp_people(event_id uuid, occurrence_start timestamptz)
returns table (shown_name text, response text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(m.display_name, public.public_name(p.display_name, p.last_name, p.name_display, p.nickname), 'Someone'),
    r.response
  from public.calendar_rsvps r
  left join public.chat_members m on m.user_id = r.user_id
  left join public.profiles p on p.user_id = r.user_id
  where public.is_leader()
    and r.event_id = calendar_rsvp_people.event_id
    and r.occurrence_start = calendar_rsvp_people.occurrence_start
  order by r.response desc, 1
$$;

-- Reminders skip people who said they can't make it to that date.
drop function public.calendar_push_recipients(uuid);
create function public.calendar_push_recipients(event_id uuid, occurrence_start timestamptz default null)
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
  from public.calendar_events e
  join public.profiles p on public.chat_room_for(p.track, p.gender) = any (e.rooms)
  join public.push_subscriptions s on s.user_id = p.user_id and s.notify_events
  where e.id = calendar_push_recipients.event_id
    and not exists (
      select 1 from public.calendar_rsvps r
      where r.event_id = e.id and r.user_id = p.user_id and r.response = 'no'
        and r.occurrence_start = calendar_push_recipients.occurrence_start
    )
$$;

revoke execute on function
  public.calendar_can_see(uuid),
  public.calendar_rsvp(uuid, timestamptz, text),
  public.calendar_rsvp_summary(timestamptz, timestamptz),
  public.calendar_rsvp_people(uuid, timestamptz),
  public.calendar_push_recipients(uuid, timestamptz)
from public, anon;
revoke execute on function public.calendar_push_recipients(uuid, timestamptz) from authenticated;
grant execute on function
  public.calendar_can_see(uuid),
  public.calendar_rsvp(uuid, timestamptz, text),
  public.calendar_rsvp_summary(timestamptz, timestamptz),
  public.calendar_rsvp_people(uuid, timestamptz)
to authenticated;
grant execute on function public.calendar_push_recipients(uuid, timestamptz) to service_role;
