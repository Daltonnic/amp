# Deploying the installable web app (PWA)

The PWA is the app people can install today — from Safari (Share → **Add to Home Screen**) or Chrome (**Install app**) — while the store versions are in review. It's a static site: any static host works.

## Build

Set the environment variables from `.env.example` in your host (or in `.env.production.local` when building locally), then:

```bash
npm run build
```

The output is in `dist/`. It must be served over **HTTPS** (required for installing and for the service worker).

## Hosts

Configuration for the common hosts is already in the repo:

| Host                               | What's included                                         |
| ---------------------------------- | ------------------------------------------------------- |
| **Vercel**                         | `vercel.json` — SPA rewrites, security headers, caching |
| **Netlify** / **Cloudflare Pages** | `public/_redirects` and `public/_headers`               |

Settings for all of them: build command `npm run build`, output directory `dist`, Node 22.

The headers include a strict Content Security Policy that allows the app to talk only to itself and `*.supabase.co`. If you use a custom Supabase domain, add it to `connect-src` in both `vercel.json` and `public/_headers`.

## After deploying

- Visit `/privacy` — this is the privacy policy URL both stores ask for.
- In Supabase → Authentication → URL Configuration, set **Site URL** to your PWA's address.
- Optionally restrict the Edge Functions to your origins: `npx supabase secrets set ALLOWED_ORIGINS=https://app.example.org,capacitor://localhost,https://localhost` (the last two are the iOS and Android apps).

## Updates

When you deploy a new version, open users see a "A new version of AMP is ready — Update" message rather than being reloaded mid-entry. The service worker caches only the app itself, never anyone's personal data.

## What works differently in the PWA

- **Daily reminders** are delivered by the native apps only (iOS doesn't let web apps schedule reliable local notifications). The setting is saved and takes effect when the person installs the store app.
- **Face ID / fingerprint unlock** is native-only; the PIN lock works everywhere.
