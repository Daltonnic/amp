# Releasing to the App Store and Google Play

The native projects are in `ios/` and `android/`. They wrap the same web app as the PWA, plus native features: daily reminder notifications, Face ID / Touch ID / fingerprint unlock, haptics, a privacy screen in the app switcher, and native splash screens.

## Before anything: decisions that are hard to change later

1. **App ID** — `org.apostolicmoralpurity.app` is set in `capacitor.config.ts`, the Xcode project and `android/app/build.gradle`. It is permanent once published. If you prefer another (it should be a domain you control, reversed), change it in all three places before your first upload.
2. **Who publishes** — Enroll as an **organization** (your ministry or company) rather than an individual, on both stores. The store listing shows the publisher's legal name, and Google Play organization accounts skip the 14-day closed-test requirement for new personal accounts. Apple requires a D-U-N-S number for organizations (free; it can take a couple of weeks).
3. **Backend live** — Complete [SUPABASE_SETUP.md](SUPABASE_SETUP.md) and deploy the PWA ([DEPLOY_PWA.md](DEPLOY_PWA.md)) first. Both stores need your privacy policy URL (`https://<your-pwa>/privacy`), and reviewers will sign in.

Fill in `.env.production.local` (same keys as `.env.example`), then build and copy the web app into both native projects:

```bash
npm run cap:sync
```

Run this after every web change before building the native apps.

## Demo account for reviewers

Apple and Google reviewers must be able to sign in with an account you give them:

1. In the app, tap **Create an account** and make one for review, e.g. `review@yourdomain.org` with a strong password.
2. Finish onboarding, and add a few check-ins and an accountability contact (use your own mobile number) so reviewers see a lived-in app.
3. Put the email and password in App Store Connect (App Review Information) and Play Console (App access).

## iPhone — App Store

You need: a Mac with the current Xcode, and an Apple Developer Program membership ($99/year).

1. Open the project:

   ```bash
   npm run cap:ios
   ```

2. In Xcode, select the **App** target → **Signing & Capabilities**: choose your Team. Leave "Automatically manage signing" on.
3. Set the version under **General**: Version `1.0.0`, Build `1` (increase Build for every upload).
4. Set up group push notifications (Apple key + Firebase) as described in [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md), and build with `VITE_NATIVE_PUSH=true`.
5. Run on a real iPhone once: test sign-in, a check-in, reminders (allow notifications, then set a reminder a minute ahead in Settings), a group notification with the app closed, Face ID lock, and Delete Account.
6. **Product → Archive**, then **Distribute App → App Store Connect**. The build appears in TestFlight in about 15 minutes, where you can invite testers.
7. In [App Store Connect](https://appstoreconnect.apple.com), create the app (bundle ID above) and fill in the listing below, then **Add for Review**.

Already handled in the project:

- Face ID permission text, export-compliance flag (standard HTTPS only), portrait orientation.
- iPhone-only (iPads run it in compatibility mode, so iPad screenshots aren't required).
- `PrivacyInfo.xcprivacy` privacy manifest.
- In-app account deletion (Guideline 5.1.1(v)) and AI data-sharing consent (5.1.2).
- No third-party login, so Sign in with Apple isn't required.

## Android — Google Play

You need: Android Studio, and a Google Play developer account ($25 once).

1. Open the project:

   ```bash
   npm run cap:android
   ```

2. Create an upload key once and keep it safe (back it up — losing it complicates future updates): **Build → Generate Signed App Bundle** → create a new keystore. Never commit the `.jks` file.
3. Increase `versionCode` in `android/app/build.gradle` for every upload; `versionName` is the public version.
4. **Build → Generate Signed App Bundle** → release. Upload the `.aab` in Play Console.
5. Enroll in **Play App Signing** when prompted.
6. Start with **Internal testing**, then **Closed testing**. A new _personal_ developer account must run a closed test with at least 12 testers for 14 days before it can publish to production.

Already handled in the project:

- Targets Android 16 (API 36), with edge-to-edge layout.
- Portrait orientation.
- Cloud backup and device-to-device transfer of app data disabled (personal data and the login session never leave the phone that way).
- Exact-alarm permission removed (reminders don't need it).
- Notification icon included.
- Push notifications: add `google-services.json` and the Firebase secret first ([PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md)), and build with `VITE_NATIVE_PUSH=true`.

## Store listing

**Name:** Apostolic Moral Purity
**Subtitle (iOS) / short description (Play):** Christ-centered recovery and healing

**Description:**

> Apostolic Moral Purity is a Christ-centered recovery and support app for those affected by sexual addiction. Built from an Apostolic framework, it provides Scripture-based teaching, reflection prompts, recovery tools, accountability, and support for emotional and spiritual healing — helping individuals and families pursue purity, rebuild trust, process betrayal, and walk toward lasting freedom and wholeness in Christ.
>
> Two journeys, one app:
> • For men pursuing freedom from sexual brokenness
> • For spouses processing betrayal
>
> • Daily check-ins — name what you feel, notice patterns over the week
> • Grounding tools — slow breathing, body grounding, 5-4-3-2-1, guided prayer, Scripture and truth reminders
> • A private journal with guided prompts and morning and evening templates
> • Trigger awareness — log what happened and work through it with the AI Grounding Guide
> • Identity & Scripture — truths about who you are in Christ
> • Accountability — one tap to let a trusted person know you need support
> • Daily reminders, PIN and Face ID lock, dark mode
>
> No performance. No shame. Just honest, steady growth — rooted in Christ and carried by grace.
>
> AMP is a support tool, not a substitute for a pastor, counselor, or medical care. If you are in crisis in the U.S., call or text 988.

**Category:** Health & Fitness (or Lifestyle).
**Keywords (iOS):** recovery, purity, accountability, christian, scripture, journal, betrayal, healing, prayer, grounding

**Screenshots:** ready-made in `store/screenshots/ios` (1320×2868, the required 6.9" iPhone size) and `store/screenshots/android` (1080×2400). Regenerate after UI changes with `node scripts/store-screenshots.mjs` (see the script header).

**Icon:** iOS uses `ios/App/App/Assets.xcassets/AppIcon.appiconset`; Play Console asks for a 512×512 icon — use `public/icons/icon-512.png`. Play also needs a 1024×500 feature graphic (not included; create one from the logo in `public/brand/`).

**Support URL:** your PWA URL or ministry site. **Privacy policy URL:** `https://<your-pwa>/privacy` — review its wording (`src/pages/Privacy.tsx`) and set `VITE_SUPPORT_EMAIL` first.

**Age rating:** answer the questionnaires honestly. Because the app discusses sexual addiction (without explicit content), expect a mature rating such as 16+/17+ on Apple and "Mature 17+" or similar on Play.

## Privacy questionnaires

Both stores ask what data the app collects. Accurate answers for this codebase:

| Data                                                                            | Collected | Linked to the user | Purpose                     | Tracking / ads |
| ------------------------------------------------------------------------------- | --------- | ------------------ | --------------------------- | -------------- |
| Email address                                                                   | Yes       | Yes                | App functionality (sign-in) | No             |
| Name (optional display name; contacts' names)                                   | Yes       | Yes                | App functionality           | No             |
| Phone number (accountability contacts)                                          | Yes       | Yes                | App functionality           | No             |
| Sensitive info (recovery and faith context)                                     | Yes       | Yes                | App functionality           | No             |
| Other user content (check-ins, journal, trigger logs, group messages)           | Yes       | Yes                | App functionality           | No             |
| Device push token (only if notifications are turned on)                         | Yes       | Yes                | App functionality           | No             |
| Health & fitness, location, contacts list, identifiers, usage data, diagnostics | No        | —                  | —                           | —              |

- **Apple — App Privacy:** use the table above. "Data used to track you": none.
- **Google — Data safety:** the same data types. Encrypted in transit: **yes**. Users can request deletion: **yes** (in-app). Data shared with third parties: data is _processed_ by service providers (Supabase hosting and sign-in, Anthropic for the AI guide), which Google does not count as "sharing".
- **Google — account deletion URL:** Play requires a web link where people can ask for deletion. Use `https://<your-pwa>/settings` (sign in → Delete Account) and mention your support email on the privacy page.
- **Google — Health apps declaration** (App content): declare it as a wellness/support app, not a medical device.

## App Review tips

- Don't describe the app as treating or curing addiction; "support", "recovery tools" and "Christ-centered" are accurate.
- Avoid empty sections: the Library only appears once an article is published, so either publish a few articles before submitting or launch without it.
- In the review notes, mention: the demo account, that the AI Grounding Guide is on Trigger Awareness → Log → Start Grounding Session, and that account deletion is in Settings.
- If Apple raises Guideline 4.2 (minimum functionality), point to the native features: scheduled local notifications, biometric app lock, haptics, privacy screen and offline grounding tools.

## Every release

```bash
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

```bash
npm run cap:sync
```

Then bump the iOS Build number and Android `versionCode`, archive, and upload. Web-only fixes can go out instantly through the PWA; store apps pick them up at their next release.
