# Backend setup (Supabase)

The app needs one Supabase project. The free plan is enough to start.

> **Already done for the "AMP Mobile" project.** The database, sign-in settings and server functions below were set up and tested on 2026-11-20. Use this guide for a new project, or to check settings.

## 1. Create and link the project

Create a project at [supabase.com](https://supabase.com) (or connect one through Vercel's Supabase integration), then from this folder:

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

This applies everything in `supabase/migrations/`: the tables, Row Level Security (each person can only read and change their own rows), the table grants (newer Supabase projects don't expose new tables to the API until they're granted), and later changes such as multi-select check-in feelings. `npm run test:db` proves the security rules against a real PostgreSQL.

## 3. Sign-in (email + password)

In **Authentication → Sign In / Providers → Email**:

- Email provider: **on**
- **Confirm email: off**, so people can start using the app the moment they create an account
- Minimum password length: **8**

In **Authentication → URL Configuration**:

- **Site URL:** your web app's address (the Vercel integration sets this)
- **Redirect URLs:** keep the Vercel entries and add `capacitor://localhost` and `https://localhost` for the phone apps

### Password-reset emails

"Forgot password?" emails a link that opens the web app's `/reset-password` page. Supabase's built-in email sender only delivers to your own team's addresses (about 2 an hour), so **before launch connect an email sender** in **Authentication → Emails → SMTP Settings**. Any SMTP account works, for example:

| Provider                 | Host                 | Port | Username          | Password                                                                                 |
| ------------------------ | -------------------- | ---- | ----------------- | ---------------------------------------------------------------------------------------- |
| Gmail / Google Workspace | `smtp.gmail.com`     | 465  | your full address | an [app password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification) |
| Outlook / Microsoft 365  | `smtp.office365.com` | 587  | your full address | your password or an app password                                                         |
| Resend                   | `smtp.resend.com`    | 465  | `resend`          | a Resend API key                                                                         |

Set the sender name to something like "AMP: The Journey". Once connected you can also edit the email wording in **Authentication → Emails → Templates → Reset Password**.

## 4. Server functions

Two Edge Functions:

| Function          | What it does                                            | Needs               |
| ----------------- | ------------------------------------------------------- | ------------------- |
| `delete-account`  | Settings → Delete Account (required by both app stores) | nothing extra       |
| `grounding-guide` | The AI Grounding Guide on Trigger Awareness             | `ANTHROPIC_API_KEY` |

```bash
npx supabase functions deploy delete-account --no-verify-jwt
```

```bash
npx supabase functions deploy grounding-guide --no-verify-jwt
```

To turn on the Grounding Guide, add an [Anthropic API key](https://console.anthropic.com):

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Until then, the guide politely says it isn't set up yet; the grounding tools always work. Optional: `GROUNDING_GUIDE_MODEL` (default `claude-opus-5-5`), `GROUNDING_GUIDE_EFFORT` (`low` default), and `ALLOWED_ORIGINS` (comma-separated origins allowed to call the functions). The guide's instructions live in `supabase/functions/grounding-guide/prompt.ts` (keep its SAFETY section). Limit: 60 messages per person per hour, 200 per day.

"I Need Support" and "Request Check-In" don't use the server at all: they open a ready-to-send text (or email) on the person's own phone.

## 5. Point the app at it

With Vercel's Supabase integration, nothing to do: the build reads its variables automatically. Otherwise set these in Vercel (and in `.env.local` for local development), from **Project Settings → API Keys**:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPPORT_EMAIL=support@yourdomain.org
```

The publishable key is safe in the app — Row Level Security protects the data. **Never** use the secret / service-role key in the app; the build refuses to include it.

## 6. Library articles

Library articles live in the `library_articles` table. Add or edit them in **Table Editor → library_articles**: `title`, `content` (blank lines separate paragraphs), `category`, `track` (`men`, `spouse` or `both`), and optionally `scripture_reference`, `read_time_minutes` and `tags`. `published` controls visibility; `featured` pins up to three to the top.

The Library stays hidden from the app's menu until at least one article is published.

## Local development against a local Supabase (optional)

```bash
npx supabase start
```

This runs Postgres, Auth and an email inbox at http://localhost:54324 (password-reset emails land there). Use the printed API URL and anon key in `.env.local`.
