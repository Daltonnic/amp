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
(phone or computer). New messages arrive live while the app is open, and the
Group tab shows an unread count. When AMP is closed, people who turned on
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

Moderators get a **Moderator** badge, a **Reports** button in the group
header, and can delete any message or remove a person from the group. Someone
who is removed can't see the group or rejoin it. Everything else in the app
keeps working for them.

There are no moderators until you make some. Each group needs its own: men
moderate the men's groups and women the women's groups, because nobody can see
a group they aren't in.

To make someone a moderator, they first join their group in the app. Then, in
the Supabase dashboard → **SQL Editor**, run (with their sign-in email):

```sql
update public.chat_members
set role = 'moderator'
where user_id = (select id from auth.users where email = 'their-email@example.com');
```

To make them a regular member again, run the same with `role = 'member'`.

To let a removed person back in:

```sql
delete from public.chat_bans
where user_id = (select id from auth.users where email = 'their-email@example.com');
```

## Safety, and what the app stores require

Apple (App Review Guideline 1.2) and Google Play require apps with
user-generated content to have: agreement to terms before posting, a way to
report content, a way to block people, and moderation that acts on reports.
All of these are built in: the guidelines must be accepted before joining,
and reporting, blocking, moderators and auto-hiding after three reports are
all included. Keep at least one active moderator per group before
launch, and put a contact email in the privacy policy
(`VITE_SUPPORT_EMAIL`).

Other safeguards:

- Text only: no photos, and links are never made clickable.
- At most 15 messages a minute per person.
- Every change goes through a database function that checks the person is an
  active member of the right group (`supabase/migrations/*_group_chat.sql`).
  The app can only read chat tables, and Row Level Security limits reads to
  the person's own group. `supabase/tests/chat.sql` tests all of this.
- Deleting an account deletes every message that person posted.

**Man or woman is self-reported.** Someone could change it in Settings to get
into a different group. Moderators are the safeguard: they see when people join
("… joined the group") and can remove anyone. If this becomes a problem, a
next step is to have moderators approve new members before they can see the
group.

## Not included yet

- Editing a sent message (delete and resend instead).
