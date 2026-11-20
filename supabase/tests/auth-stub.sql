-- Minimal stand-in for the Supabase `auth` schema so migrations and RLS can be
-- tested against plain PostgreSQL (see supabase/tests/run.sh).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Mirror current Supabase defaults: API roles get NO data privileges on new
-- tables, so the migrations must grant them explicitly.
alter default privileges in schema public grant truncate, references, trigger on tables to anon, authenticated, service_role;
