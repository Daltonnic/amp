# Backend setup (Supabase)

The app needs one Supabase project. The free tier is enough to start.

You'll need:
- a [Supabase](https://supabase.com) account
- a [Resend](https://resend.com) account (for accountability emails and sign-in codes) with your domain verified
- an [Anthropic API](https://console.anthropic.com) key (for the Grounding Guide)

## 1. Create the project

1. In Supabase, create a new project. Pick the region closest to your users.
2. Install the CLI and link it from this folder:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <your-project-ref>
```

## 2. Create the database

```bash
npx supabase db push
```

This creates the tables and Row Level Security from `supabase/migrations/`. Every personal table only lets a signed-in user see and change their own rows, and deleting a user deletes all of their data. `npm run test:db` proves this against a real PostgreSQL.

## 3. Configure sign-in (email codes)

In **Authentication → Sign In / Providers → Email**:
- Email provider: **on**. "Confirm email": **off** (the code itself confirms the address).
- Email OTP length: **6**. Expiry: **900** seconds.

In **Authentication → Emails → Templates**, set **both** "Magic Link" and "Confirm signup" to the contents of `supabase/templates/sign-in-code.html`, with subject `Your AMP sign-in code`. The template shows `{{ .Token }}` — the 6-digit code people type into the app.

In **Authentication → Emails → SMTP Settings**, turn on custom SMTP and enter your Resend SMTP details (host `smtp.resend.com`, port 465, user `resend`, password = a Resend API key, sender e.g. `care@yourdomain.org`). Supabase's built-in email is limited to a few messages an hour and is not for production.

In **Authentication → URL Configuration**, set Site URL to your PWA's URL.

## 4. Deploy the Edge Functions

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="AMP: The Journey <care@yourdomain.org>" ANTHROPIC_API_KEY=sk-ant-xxx
```

```bash
npx supabase functions deploy send-support-email
```

```bash
npx supabase functions deploy grounding-guide
```

```bash
npx supabase functions deploy delete-account
```

Optional secrets:
- `ALLOWED_ORIGINS` — comma-separated origins allowed to call the functions (default `*`; calls are authenticated by token, not cookies).
- `GROUNDING_GUIDE_MODEL` (default `claude-opus-5-5`) and `GROUNDING_GUIDE_EFFORT` (`low` default; `medium`/`high` for more considered replies at higher latency and cost).

The Grounding Guide's instructions live in `supabase/functions/grounding-guide/prompt.ts`. If you want the exact wording of the Base44 agent, copy it from Base44 (Code → `base44/agents/grounding_guide`) into `BASE_PROMPT` and redeploy. Keep the SAFETY section.

Rate limits (per user): 5 support emails/hour and 20/day; 60 Grounding Guide messages/hour and 200/day. Adjust at the top of each function.

## 5. Point the app at it

Copy `.env.example` to `.env.local` and fill in values from **Project Settings → API keys**:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPPORT_EMAIL=support@yourdomain.org
```

The publishable (anon) key is safe in the app — Row Level Security protects the data. **Never** put the service-role key in the app or in `.env.local`.

## 6. Library articles

Library articles live in the `library_articles` table. Add or edit them in **Table Editor → library_articles**: `title`, `content` (blank lines separate paragraphs), `category`, `track` (`men`, `spouse` or `both`), and optionally `scripture_reference`, `read_time_minutes` and `tags`. `published` controls visibility; `featured` pins up to three to the top.

The Library stays hidden from the app's menu until at least one article is published, so launching without articles is fine. If you had articles in Base44, [MIGRATION_FROM_BASE44.md](MIGRATION_FROM_BASE44.md) can import them.

## Local development against a local Supabase (optional)

```bash
npx supabase start
```

This runs Postgres, Auth and an email inbox at http://localhost:54324 where sign-in codes arrive. Use the printed API URL and anon key in `.env.local`.
