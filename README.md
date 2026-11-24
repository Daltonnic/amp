# AMP: The Journey — Apostolic Moral Purity

A Christ-centered recovery and support app for those affected by sexual addiction. Built from an Apostolic framework, it offers Scripture-based teaching, reflection prompts, recovery tools, accountability, and support for emotional and spiritual healing — for men pursuing freedom and for spouses processing betrayal.

This repository is the rebuild of the Base44 app (`amp-copy-4b2a15f1.base44.app`) as **one codebase that ships three ways**:

| Target                        | How                                      | Status                  |
| ----------------------------- | ---------------------------------------- | ----------------------- |
| **Installable web app (PWA)** | `npm run build` → any static host        | Ready to deploy now     |
| **iPhone (App Store)**        | Capacitor → Xcode project in `ios/`      | Ready to build & submit |
| **Android (Google Play)**     | Capacitor → Gradle project in `android/` | Ready to build & submit |

## What's inside

Every screen from the Base44 app, with its original wording, Scripture, prayers and prompts carried over verbatim:

| Screen               | Path              | Notes                                                                                                                               |
| -------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sign in              | `/sign-in`        | Email + password, create account, forgot password                                                                                   |
| Reset password       | `/reset-password` | Opened from the reset email; also Settings → Change Password                                                                        |
| Onboarding           | `/welcome`        | Man or woman, track (recovery / betrayed spouse), reason, needs, reminders                                                          |
| Home                 | `/home`           | Quick actions (**Help Me Now** lists your support people, each a ready-to-send text), encouragement, weekly insights, Today's Focus |
| Daily Check-In       | `/check-in`       | 6 steps, different for each track                                                                                                   |
| Grounding Tools      | `/grounding`      | Breathing, body grounding, 5-4-3-2-1, prayer, truths, Scripture, reassurance (spouse)                                               |
| Journal              | `/journal`        | Templates, guided prompts, free writing, edit/delete, auto-saved drafts                                                             |
| Group                | `/group`          | GroupMe-style chat, one of four separate groups per person (see [docs/GROUP_CHAT.md](docs/GROUP_CHAT.md))                           |
| Resources            | `/resources`      | Men's and spouses' articles                                                                                                         |
| Library              | `/library`        | Admin-published articles (from the database); appears in the menu once at least one is published                                    |
| Trigger Awareness    | `/triggers`       | Trigger log, then straight to the grounding tools                                                                                   |
| Identity & Scripture | `/identity`       | Truths and Scripture meditation                                                                                                     |
| Accountability       | `/accountability` | Trusted contacts; request a check-in, text, call                                                                                    |
| Calendar             | `/calendar`       | Each group's meetings; leaders add events with repeats and reminder notifications ([docs/CALENDAR.md](docs/CALENDAR.md))            |
| Notifications        | `/notifications`  | The bell on Home: replies, join requests and approvals, new leaders, meeting reminders ([docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)) |
| Leaders              | `/leaders`        | Leaders only: approve join requests for every group, see everyone, make or step down leaders                                        |
| Settings             | `/settings`       | Name and how it shows, man/woman, group, reminders, appearance, PIN/Face ID lock, sign out, delete account                          |
| Privacy Policy       | `/privacy`        | Public page (required by both stores)                                                                                               |

Old Base44 links (`/CheckIn`, `/TriggerAwareness`, `/IdentityFormation`, `/Onboarding`, …) redirect to the new paths.

### Fixed and improved along the way

- **App lock actually works.** Base44 saved the PIN in plain text in the database and never asked for it. Now the PIN is hashed on-device (PBKDF2) and locks the app at launch and after 30 s in the background, with Face ID / Touch ID / fingerprint on phones.
- **Daily reminders are real** local notifications at a time you choose (native apps).
- **Dates are local.** Base44 stored check-ins by UTC date, so evening check-ins in the U.S. landed on tomorrow.
- **Account deletion deletes the account**, not just the rows (App Store requirement).
- **Men's weekly chart** no longer plots an "intensity" men are never asked for (it sat flat at 5); it shows stress and temptation.
- Journal entries can be **edited**; deletes ask for confirmation; unsaved drafts survive leaving the screen.
- **I Need Support / Request Check-In** open a pre-written text from the person's own phone (email if the contact has no mobile number) instead of a server email, so contacts know exactly who it's from.
- Daily check-in lets you pick **as many feelings as fit**, and insights count all of them.
- Accessible (labels, focus, 44 pt touch targets, reduced motion, screen-reader chart table), dark mode, offline banner, ~400 KB lighter (custom chart instead of recharts), self-hosted fonts (no Google requests).
- Personal data is never cached by the service worker, never backed up to Google Drive, and the app is blurred in the task switcher.

## Architecture

```
src/
  app/            router, auth/onboarding gates, tab layout
  pages/          one file per screen
  components/     UI kit (Tailwind + Radix), tab bar, lock screen, chart, AI guide
  content/        all copy, Scripture, prompts (extracted verbatim from Base44)
  data/           typed backend interface + Supabase and on-device implementations, React Query hooks
  lib/            auth, theme, reminders, app lock, haptics, dates, support texts
supabase/
  migrations/     schema + Row Level Security (one owner per row)
  functions/      notify-group (push notifications), delete-account
  tests/          RLS test suite (runs on plain PostgreSQL)
ios/ android/     Capacitor native projects
scripts/          Base44 → Supabase importer
```

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, TanStack Query, React Router.
- **Backend:** [Supabase](https://supabase.com) — Postgres with Row Level Security, email + password auth, Edge Functions.
- **Native:** Capacitor 8 (local notifications, biometrics, haptics, privacy screen, splash, edge-to-edge).
- **PWA:** vite-plugin-pwa (offline app shell, install prompt, update prompt).

**On-device mode:** if `VITE_SUPABASE_URL` is not set, the app runs entirely in the browser with data in local storage — no account needed. It's for development, demos and automated tests; email and the AI guide need the cloud backend.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. With no `.env.local`, you're in on-device mode.

To connect a backend, copy `.env.example` to `.env.local` and follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Scripts

| Command                                   | What it does                                                         |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                             | Dev server                                                           |
| `npm run build`                           | Type-check + production build into `dist/`                           |
| `npm run lint` / `npm run typecheck`      | ESLint / TypeScript                                                  |
| `npm run typecheck:functions`             | Type-check the Supabase Edge Functions                               |
| `npm test`                                | Unit tests (Vitest)                                                  |
| `npm run test:e2e`                        | End-to-end tests at iPhone size (Playwright)                         |
| `npm run test:db`                         | Apply migrations to a throwaway Postgres and test Row Level Security |
| `npm run cap:ios` / `npm run cap:android` | Build, sync and open Xcode / Android Studio                          |
| `npm run assets`                          | Regenerate native icons and splash screens from `resources/`         |
| `npm run import:base44`                   | Import Base44 data exports into Supabase                             |

## Guides

- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) — create the backend (database, auth, email, push)
- [docs/MIGRATION_FROM_BASE44.md](docs/MIGRATION_FROM_BASE44.md) — only if the Base44 app has real users or articles to bring over (a fresh launch can skip it)
- [docs/DEPLOY_PWA.md](docs/DEPLOY_PWA.md) — put the installable web app online
- [docs/APP_STORE_RELEASE.md](docs/APP_STORE_RELEASE.md) — ship to the App Store and Google Play
