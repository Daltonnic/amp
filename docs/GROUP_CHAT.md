# Group chat

The **Group** tab is a GroupMe-style chat. There are four groups, and each
person can only ever see and post in the one that matches their profile:

| Group                       | Who                                 |
| --------------------------- | ----------------------------------- |
| Men in Recovery             | Men working on their own recovery   |
| Women in Recovery           | Women working on their own recovery |
| Men Healing from Betrayal   | Men whose spouse betrayed them      |
| Women Healing from Betrayal | Women whose spouse betrayed them    |

The group comes from two answers in the profile: **man or woman** and **track**
(recovery or betrayed spouse). If someone changes either one in Settings, they
leave their old group automatically and can join the new one.

It works the same in the iPhone and Android apps and in any web browser
(phone or computer). New messages arrive live while the app is open, with no
refreshing, and the Group tab shows an unread count. Phones pause apps in the
background and can quietly drop the live connection, so whenever AMP comes
back to the screen (or the network comes back) it fetches anything missed at
once and reconnects; while the connection is down it checks every 15 seconds.
When AMP is closed, people who turned on
notifications get a push notification (see
[PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md)).

## What members can do

- Join after choosing how their name shows and agreeing to the group guidelines.
- Send messages (text only, up to 2,000 characters), reply to a message, like
  messages, copy text, and delete their own messages.
- See who is in the group.
- **Report** a message. Reporters stay anonymous. A message reported by three
  different people is hidden until a moderator reviews it.
- **Block** someone. Their messages disappear for the person who blocked them,
  on every device. They aren't told. Unblock in Settings → Group.
- Leave the group (Group tab → tap the group name, or Settings → Group).

## How names show

Settings → Profile (and the join screen) let each person choose how others see
their name:

| Choice                      | Example            |
| --------------------------- | ------------------ |
| First name and last initial | David M. (default) |
| First name only             | David              |
| Initials only               | D.M.               |
| Full name                   | David Miller       |
| A nickname                  | Steady Walker      |

The name shown in the group is worked out on the server from the profile
(`public.public_name()`), so nobody can post under a name they didn't choose,
and a name change updates every message straight away.

## Moderators

Moderators are marked with a yellow shield. In the code and database they're
called leaders (the `leaders` table, `is_leader()`), the name they had first.

Moderators run the groups. They show in **gold** everywhere: a gold ring around
their initials, a **Moderator** tag with a yellow shield next to their name, and a soft gold message
bubble. Moderators have a **Moderators** page (More → Moderators) where they:

- **Approve or decline requests** to join any of the four groups. Everyone who
  isn't a moderator asks to join and waits; moderators get a notification when
  someone asks, and the person gets one when they're approved. Moderators see only the
  name each person chose to show their group, their group and when they signed
  up, never their email or real first and last name (enforced in the database
  by `public.leader_people()`). A declined person can ask
  again.
- **See everyone** with an account and whether they're in a group.
- **Make other people moderators**, or step someone down. There's always at least
  one moderator.

In the group they belong to, moderators also moderate: a **Reports** button in the
group header, deleting any message, and removing people (who then can't see
the group or rejoin it). Moderators can't be removed from a group; step them down
first. Each group stays private: moderators only read the group they're in, so
the women's groups need a woman moderator to review their reports. Approving join
requests works for every group.

Moderators join their own group without waiting. People who were in a group
before approvals existed stayed in it. Changing man/woman or track moves
someone out of their group, and joining the new one needs approval.

The first moderators were set with SQL. To add one that way (for example if every
moderator stepped away), in the Supabase dashboard → **SQL Editor**:

```sql
insert into public.leaders (user_id)
select id from auth.users where email = 'their-email@example.com';
```

To let a removed person back into their group:

```sql
delete from public.chat_bans
where user_id = (select id from auth.users where email = 'their-email@example.com');
```

## Safety, and what the app stores require

Apple (App Review Guideline 1.2) and Google Play require apps with
user-generated content to have: agreement to terms before posting, a way to
report content, a way to block people, and moderation that acts on reports.
All of these are built in: the guidelines must be accepted before joining,
and reporting, blocking, moderators who moderate, approval of new members and
auto-hiding after three reports are all included. Keep at least one moderator in
each group before launch, and put a contact email in the privacy policy
(`VITE_SUPPORT_EMAIL`).

Other safeguards:

- Text only: no photos, and links are never made clickable.
- At most 15 messages a minute per person.
- Every change goes through a database function that checks the person is an
  active member of the right group (`supabase/migrations/*_group_chat.sql`).
  The app can only read chat tables, and Row Level Security limits reads to
  the person's own group. `supabase/tests/chat.sql` tests all of this.
- Deleting an account deletes every message that person posted.

**Man or woman is self-reported.** Someone could change it in Settings, but
that takes them out of their group, and a moderator has to approve them into the
new one.

## Not included yet

- Editing a sent message (delete and resend instead).
