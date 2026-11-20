-- =============================================================================
-- Explicit table privileges for the API roles.
--
-- Newer Supabase projects no longer grant SELECT/INSERT/UPDATE/DELETE on new
-- tables to `authenticated` / `service_role` by default. Row Level Security
-- (see the init migration) still decides WHICH rows a user can touch; these
-- grants decide whether the role may use the table at all.
--
-- `anon` (signed-out visitors) intentionally gets nothing.
-- =============================================================================

grant usage on schema public to authenticated, service_role;

-- Signed-in users: full access to their own personal records (RLS-scoped).
grant select, insert, update, delete on table
  public.profiles,
  public.check_ins,
  public.journal_entries,
  public.trigger_logs,
  public.grounding_sessions,
  public.accountability_contacts
to authenticated;

-- Signed-in users: read-only (published Library articles, their own send/AI logs).
grant select on table
  public.library_articles,
  public.outbound_emails,
  public.ai_usage
to authenticated;

-- Edge Functions (service role): rate-limit logs, account deletion, admin tasks.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
