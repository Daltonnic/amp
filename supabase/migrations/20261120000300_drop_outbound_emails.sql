-- "I Need Support" and "Request Check-In" now open a pre-written text (or
-- email) on the user's own phone. The server no longer sends email, so its
-- send log is no longer needed.

drop table if exists public.outbound_emails;
