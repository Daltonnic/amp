# Push notifications

People can get a notification when someone posts in their group, **even when
AMP is closed**. The phone or computer delivers it, so it shows on the lock
screen and in the notification center.

- **Turn on:** the **Turn on notifications** button on Home (one tap), or
  **Settings → Notifications → Push notifications**.
- **Turn off:** the same switch in Settings. It applies to this device only.
- **Show message text:** off by default. Notifications just say "New message
  in your group" (several stack into "3 new messages in your group"), so
  nothing about recovery shows on a lock screen. Turning it on shows the group,
  the person's name and the message.

Nobody is notified about their own messages, about other groups, or about
someone they blocked. Signing out turns notifications off on that device.

## Where it works

| Where                                    | How                                              | Works when AMP is closed           |
| ---------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| Android phone (Chrome, or installed)     | Web Push                                         | Yes                                |
| iPhone / iPad, AMP on the Home Screen    | Web Push (iOS 16.4 or later)                     | Yes                                |
| iPhone / iPad in Safari (not installed)  | Not possible: Apple only allows Home Screen apps | — (the app explains how to add it) |
| Computer (Chrome, Edge, Firefox, Safari) | Web Push                                         | Yes, while the browser is running  |
| App Store app                            | Apple Push Notification service                  | Yes, once set up (below)           |
| Google Play app                          | Firebase Cloud Messaging                         | Yes, once set up (below)           |

## How it works

1. Turning it on saves this device's push address in `public.push_subscriptions`
   (`push_register()`).
2. When a message is posted, the trigger `chat_messages_push` calls the
   `notify-group` Edge Function through `pg_net`, with a shared secret.
3. `notify-group` asks `push_recipients()` who should hear about it (the other
   active members of that group, minus anyone who blocked the author), then
   sends:
   - Web Push: encrypted (RFC 8291) and signed with the app's VAPID key
     (RFC 8292). See `supabase/functions/_shared/webpush.ts`; the unit tests
     check it against the RFC's own example.
   - Android: Firebase Cloud Messaging. iPhone app: Apple Push Notification
     service. See `_shared/nativepush.ts`.
4. Devices the push service says are gone are deleted automatically.
5. The service worker (`public/push-sw.js`) shows the notification and sets
   the app-icon badge. Tapping it opens the Group tab.

### Live configuration (already done)

| Where                               | Name                                      | What                                           |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| Supabase → Edge Functions → Secrets | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`   | The Web Push key pair                          |
|                                     | `VAPID_SUBJECT`                           | `https://amp-amp-56fd.vercel.app`              |
|                                     | `PUSH_WEBHOOK_SECRET`                     | Shared secret the database sends               |
| Supabase → Vault                    | `push_webhook_url`, `push_webhook_secret` | Where the trigger sends, and the same secret   |
| App (`src/lib/config.ts`)           | `vapidPublicKey`                          | The public half, used by browsers to subscribe |

The VAPID public key is public by design. **Don't change the key pair** unless
you must: existing subscriptions are tied to it, so everyone would have to
turn notifications on again (the app replaces old subscriptions automatically
the next time they do).

## Setting up the store apps

The native apps already include the push plugin, Apple's push entitlement
(`ios/App/App/App.entitlements`) and Android's notification icon and
channel. They don't offer push until these steps are done, because Android
crashes without Firebase configured.

### iPhone (Apple)

1. [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list):
   create a key with **Apple Push Notifications service (APNs)**. Download the
   `.p8` file (only once) and note the **Key ID** and your **Team ID**.
2. In Supabase → Edge Functions → Secrets, add `APNS_KEY_P8` (the whole file's
   text), `APNS_KEY_ID` and `APNS_TEAM_ID`. (`APNS_BUNDLE_ID` defaults to
   `org.apostolicmoralpurity.app`.)
3. In Xcode, check **Signing & Capabilities** shows **Push Notifications**
   (it comes from the entitlements file).

### Android (Google)

1. In the [Firebase console](https://console.firebase.google.com), create a
   project and add an Android app with package name
   `org.apostolicmoralpurity.app`. Download `google-services.json` into
   `android/app/` (it's safe to commit; it holds no secrets).
2. Firebase → Project settings → **Service accounts** → **Generate new private
   key**. Put the whole JSON file's text in a Supabase secret named
   `FCM_SERVICE_ACCOUNT`. Keep the file private; don't commit it.

### Then build with push on

```bash
VITE_NATIVE_PUSH=true npm run cap:sync
```

Test on a real phone: turn on notifications, close the app, and have another
account post in the group.

## Troubleshooting

- **Nothing arrives:** Supabase → Edge Functions → `notify-group` → Logs shows
  each send (`sent`, `failed`, `removed`). Database → `net._http_response` shows
  whether the trigger reached the function.
- **"Notifications are blocked":** the person said no to the permission
  prompt. They have to allow AMP in the browser's or phone's settings.
- **iPhone:** web notifications only work for AMP opened from the Home Screen,
  on iOS 16.4 or later.
