-- =============================================================================
-- Push notifications for group messages, delivered even when AMP is closed.
--
-- Each device that turns notifications on is a row in push_subscriptions:
--   web      a browser / Home Screen web app (Web Push: endpoint + keys)
--   ios      the App Store app (Apple device token)
--   android  the Google Play app (Firebase token)
--
-- When a message is posted, a trigger asks the notify-group Edge Function
-- (through pg_net) to send the pushes. The function's address and shared
-- secret live in Supabase Vault (names: push_webhook_url, push_webhook_secret);
-- without them the trigger does nothing, so posting never depends on it.
-- =============================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('web', 'ios', 'android')),
  -- Web: the push service URL. Native: the device token.
  endpoint text not null unique check (char_length(endpoint) between 1 and 1000),
  p256dh text check (char_length(p256dh) <= 200),
  auth text check (char_length(auth) <= 100),
  -- Show the message text on the lock screen (off = "New message in your group").
  show_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform <> 'web' or (p256dh is not null and auth is not null and endpoint like 'https://%'))
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: owner can read" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_subscriptions: owner can delete" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

-- Turn notifications on for this device (or update its settings). Holding the
-- endpoint proves it's this device, so a device that changes hands moves to
-- whoever is signed in now.
create function public.push_register(
  platform text,
  endpoint text,
  p256dh text default null,
  auth text default null,
  show_preview boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  insert into public.push_subscriptions as s (user_id, platform, endpoint, p256dh, auth, show_preview)
  values (uid, push_register.platform, push_register.endpoint, push_register.p256dh, push_register.auth,
          coalesce(push_register.show_preview, false))
  on conflict on constraint push_subscriptions_endpoint_key do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    show_preview = excluded.show_preview,
    updated_at = now();
  -- Keep at most 10 devices per person.
  delete from public.push_subscriptions
  where id in (
    select id from public.push_subscriptions where user_id = uid
    order by updated_at desc offset 10
  );
end;
$$;

-- Turn notifications off for this device.
create function public.push_unregister(endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions s
  where s.endpoint = push_unregister.endpoint and s.user_id = auth.uid();
$$;

-- Who should be notified about a message: the other active members of that
-- group, still in it per their profile, not removed, who haven't blocked the
-- author. Used only by the notify-group function (service role).
create function public.push_recipients(message_id uuid)
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
  join public.chat_members cm on cm.room = m.room and cm.left_at is null and cm.user_id <> m.user_id
  join public.profiles p on p.user_id = cm.user_id and public.chat_room_for(p.track, p.gender) = m.room
  join public.push_subscriptions s on s.user_id = cm.user_id
  where m.id = push_recipients.message_id
    and m.kind = 'text'
    and m.deleted_at is null
    and not exists (select 1 from public.chat_bans b where b.user_id = cm.user_id and b.room = m.room)
    and not exists (select 1 from public.chat_blocks k where k.blocker = cm.user_id and k.blocked = m.user_id)
$$;

revoke execute on function public.push_register(text, text, text, text, boolean) from public, anon;
revoke execute on function public.push_unregister(text) from public, anon;
revoke execute on function public.push_recipients(uuid) from public, anon, authenticated;
grant execute on function public.push_register(text, text, text, text, boolean) to authenticated;
grant execute on function public.push_unregister(text) to authenticated;
grant execute on function public.push_recipients(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Trigger: hand each new message to the notify-group function
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end;
$$;

create function public.chat_notify_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text;
  secret text;
begin
  if new.kind <> 'text' then
    return new;
  end if;
  -- pg_net and Vault only exist on Supabase; elsewhere (tests) skip quietly.
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return new;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into target using 'push_webhook_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into secret using 'push_webhook_secret';
  if target is null or secret is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
    using target,
          jsonb_build_object('message_id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret);
  return new;
exception when others then
  -- Never let notifications get in the way of posting.
  raise warning 'chat_notify_push: %', sqlerrm;
  return new;
end;
$$;

revoke execute on function public.chat_notify_push() from public, anon, authenticated;

create trigger chat_messages_push
  after insert on public.chat_messages
  for each row execute function public.chat_notify_push();
