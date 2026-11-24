# Notifications screen

The bell at the top right of Home (and **More → Notifications**) opens a list of
everything AMP has told you. The bell shows how many are new.

| What                      | Who gets it                                                                 | Tapping it opens             |
| ------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| Someone replied to you    | The person who wrote the message                                            | The group                    |
| Someone asked to join     | Every leader                                                                | Leaders                      |
| …joined / wasn't added    | The same leaders, once any leader handles it                                | Leaders                      |
| You're in! / Not approved | The person who asked to join                                                | The group                    |
| You're now a leader       | The new leader (they also see waiting requests)                             | Leaders                      |
| Meeting reminder          | Everyone in the meeting's groups, except anyone who said they can't make it | That meeting on the calendar |

Group messages themselves aren't listed one by one; when there are unread
messages, a "3 new messages in Men in Recovery" row sits at the top.

## How it behaves

- **It works without push.** The database writes these as things happen, so the
  list is complete even for people who never turned on push notifications.
  Push (Settings → Notifications) decides only what also reaches the lock screen.
- **New vs. earlier.** New items are highlighted while you're on the screen and
  count as read when you leave it. **Mark all read** does it right away.
- **Seeing the thing counts.** Opening the group marks replies and join news
  read; opening Leaders marks requests read; opening the calendar marks meeting
  reminders read.
- **One per meeting date.** Each reminder for the same meeting date brings that
  one item back to the top as new, instead of adding another.
- **It cleans up after itself.** A deleted message or meeting takes its
  notifications with it, a withdrawn request disappears for every leader, saying
  "Can't make it" clears that meeting's reminder, and everything is deleted after
  90 days. Anyone can remove an item with ✕.
- **Live.** New items appear while the app is open (Supabase Realtime), and the
  list refreshes whenever AMP comes back to the screen.
- **Private.** Each person can read and remove only their own (Row Level
  Security). Nobody can write or edit notifications from the app; only the
  database does.

## Where it lives

- `supabase/migrations/20261128000000_notifications.sql`: the `notifications`
  table, the triggers that fill it, `notifications_mark_read()`, the meeting
  reminder scheduler (also writes here), and a daily cleanup job
  (`notifications-prune`, pg_cron).
- `supabase/tests/notifications.sql`: database tests for every case above.
- `src/data/notifications.ts`, `src/data/notificationQueries.ts`: loading,
  live updates, marking read.
- `src/pages/Notifications.tsx`, `src/components/NotificationBell.tsx`.
- Meeting reminders, in the list and as push notifications, link to
  `/calendar?event=<id>&at=<start in ms>`, which opens that meeting with its RSVP buttons.
