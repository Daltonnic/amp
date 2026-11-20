# Moving from Base44

> **Launching fresh?** If the Base44 app never had real users or Library articles, skip this guide — set up Supabase and start clean.

Everything in the Base44 app's code has been rebuilt here. Three things live only in your Base44 account and need to be brought over by you: **your users' data**, **your Library articles**, and (optionally) **the Grounding Guide agent's instructions**.

## Mapping

| Base44 | Here |
| --- | --- |
| `UserProfile` | `profiles` table (`primary_need` "a,b,c" → `primary_needs` array; `pin_code` is **not** migrated) |
| `CheckIn` | `check_ins` |
| `JournalEntry` | `journal_entries` |
| `TriggerLog` | `trigger_logs` |
| `GroundingSession` | `grounding_sessions` |
| `AccountabilityContact` | `accountability_contacts` |
| `LibraryArticle` | `library_articles` |
| `integrations.Core.SendEmail` | `send-support-email` Edge Function (Resend) |
| Agent `grounding_guide` | `grounding-guide` Edge Function (Claude) |
| Base44 login (hosted page) | Supabase Auth, email codes |
| `/Home`, `/CheckIn`, `/TriggerAwareness`… | `/home`, `/check-in`, `/triggers`… (old links redirect) |

## 1. Export from Base44

In the Base44 dashboard → **Data**, open each table and export it (CSV or JSON). Save all files in one folder, named exactly after the entity:

```
base44-export/
  UserProfile.csv
  CheckIn.csv
  JournalEntry.csv
  TriggerLog.csv
  GroundingSession.csv
  AccountabilityContact.csv
  LibraryArticle.csv
```

Treat this folder as highly sensitive (it contains journal entries) — keep it off shared drives and delete it when you're done.

## 2. Import into Supabase

First complete [SUPABASE_SETUP.md](SUPABASE_SETUP.md) steps 1–2. Then do a dry run (reads files, writes nothing):

```bash
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run import:base44 -- ./base44-export
```

Check the counts it prints, then run it for real:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run import:base44 -- ./base44-export --apply
```

What it does:
- Creates a confirmed Supabase user for every `created_by` email (or reuses an existing one).
- Imports each record under its owner, keeping original creation dates.
- Uses each record's Base44 id to make its new id, so running it again won't create duplicates.
- Validates values against the new schema (unknown trigger types become "other", out-of-range scales are clamped, contacts with invalid emails keep their phone number).
- Skips the plain-text PIN. Users who want a lock can set one in Settings — it now actually works.

The service-role key bypasses all security rules. Use it only in your terminal, never in the app.

## 3. Tell your users

Because sign-in uses emailed codes, existing users don't need a new password: they open the new app, enter the **same email** they used on Base44, type the code, and their history is there.

## 4. Grounding Guide instructions (optional)

The new Grounding Guide has its own carefully written instructions (`supabase/functions/grounding-guide/prompt.ts`). To keep the exact Base44 wording, open the Base44 editor → **Code → base44/agents → grounding_guide**, copy its instructions into `BASE_PROMPT`, keep the SAFETY section, and redeploy:

```bash
npx supabase functions deploy grounding-guide
```

## 5. Switch over

1. Deploy the PWA ([DEPLOY_PWA.md](DEPLOY_PWA.md)) and test it with your own account.
2. Re-export and re-import right before the switch to catch anything written since the first export (re-running is safe).
3. Point your domain at the new PWA. If you shared Base44 links, the old page names redirect automatically.
4. Keep the Base44 app read-only for a few weeks, then delete it and its data.
