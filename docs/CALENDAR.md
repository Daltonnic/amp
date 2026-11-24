# Calendar

Each of the four groups has its own meeting calendar. Only **leaders** add,
edit and delete events. Everyone sees the events for their own group (from
their profile: man or woman, recovery or betrayed spouse), whether or not
they've joined the group chat. Leaders see every group's events.

People find it:

- **Home**: a "Next meeting" card (hidden when nothing is scheduled).
- **Group tab**: the calendar button in the header (also on the join and
  waiting screens).
- **More → Calendar**.

The calendar shows a month view (dots mark meeting days), the selected day's
meetings, and what's coming up. Tapping a meeting shows its time, how it
repeats, where (web links are tappable), details and reminders, and offers
**Add to my calendar** (an .ics file for the phone's own calendar).

## Adding an event (leaders)

Calendar → **Add event**:

| Field      | Notes                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Title      | Required                                                                                                       |
| Groups     | One or more of the four groups (your own group is preselected; "All groups" picks all)                         |
| Date, time | In the leader's time zone. Everyone sees it in their own time zone                                             |
| How long   | 30 minutes to 4 hours                                                                                          |
| How often  | Once, every day, every week, every 2 weeks, every month; optional "repeat until"                               |
| Where      | Optional: an address/room, or an `https://` video link                                                         |
| Details    | Optional                                                                                                       |
| Reminders  | Any of: at start time, 5/15/30 minutes, 1/2 hours, 1/2 days, 1 week before. Suggested: 1 day and 1 hour before |

Edits and deletes apply to the whole series.

## Reminders

Every minute, a scheduled job (`pg_cron`: `calendar-reminders` →
`public.calendar_send_due_reminders()`) finds reminders that have come due,
records each one in `calendar_reminder_log` so it goes out once, and asks the
`notify-group` function to send push notifications to everyone in that
event's groups whose device has meeting notifications on.

Reminders are discreet by default ("A meeting starts in 1 hour"); with
**Show details** on in Settings they show the meeting's name.

Weekly meetings stay at the same local time across daylight-saving changes:
events are stored as the wall-clock time in the leader's time zone
(`starts_local` + `timezone`), and `public.calendar_occurrences()` expands the
repeats in that time zone. `supabase/tests/calendar.sql` covers this, monthly
meetings on the 31st, "repeat until", permissions, and reminders going out
once.

## Notification choices (Settings)

With **Push notifications** on, each device chooses **Everything**,
**Messages** only, or **Meetings** only (`push_subscriptions.notify_messages`
and `notify_events`), plus **Show details**.
