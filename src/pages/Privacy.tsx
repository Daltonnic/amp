import type { ReactNode } from 'react'
import { Screen, useBack } from '@/components/layout'
import { BackLink } from '@/components/layout'
import { config } from '@/lib/config'
import { paths } from '@/app/routes'

/*
 * Privacy policy. It describes what this codebase actually does. Have it
 * reviewed (and fill in VITE_SUPPORT_EMAIL) before submitting to the stores;
 * the App Store and Google Play both require a public privacy policy URL,
 * which is this page: https://<your-domain>/privacy
 */

const UPDATED = 'November 24, 2026'

function H({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 font-display text-lg font-semibold text-foreground">{children}</h2>
}

export default function Privacy() {
  const back = useBack(paths.home)
  const contact = config.supportEmail
  return (
    <div className="min-h-dvh bg-background pt-safe pb-safe">
      <Screen>
        <BackLink onClick={back} />
        <article className="space-y-3 text-[15px] leading-relaxed text-foreground/85 [&_li]:ml-5 [&_li]:list-disc">
          <h1 className="font-display text-2xl font-semibold text-foreground">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Last updated {UPDATED}</p>
          <p>
            Apostolic Moral Purity ("AMP: The Journey") is a Christ-centered recovery and support app. What
            you share here is deeply personal, so we collect as little as possible, never sell it, never use
            it for advertising, and give you a way to delete all of it at any time.
          </p>

          <H>What we collect</H>
          <ul className="space-y-1">
            <li>
              Your email address and password, used to sign you in and to send a link if you forget your
              password. Passwords are stored only as secure hashes by our sign-in provider.
            </li>
            <li>
              Your onboarding answers: whether you are a man or a woman, your track, what brought you here,
              and what you need most.
            </li>
            <li>
              Your name, if you add it, and how you choose to show it to others (for example "David M.",
              initials, or a nickname).
            </li>
            <li>
              What you choose to record: daily check-ins, journal entries, trigger logs, and which grounding
              tools you use.
            </li>
            <li>Accountability contacts you add (name, email, phone, relationship).</li>
            <li>
              If you join your group: the messages you post, the messages you like, people you block, and
              messages you report.
            </li>
          </ul>
          <p>
            We do not use analytics, advertising, or tracking tools, and we do not collect your location or
            contacts list.
          </p>

          <H>How it is stored and protected</H>
          <p>
            Your data is stored with our database provider, Supabase, encrypted in transit (TLS) and at rest.
            Database rules ensure that only your signed-in account can read or change your records.
          </p>
          <p>
            Some settings stay only on your device: your app PIN (stored as a one-way hash, never sent to us),
            reminder schedule, theme, and unsaved journal drafts.
          </p>

          <H>Your group</H>
          <p>
            There are four separate groups: men in recovery, women in recovery, men healing from betrayal, and
            women healing from betrayal. You can only join, see and post in the one that matches your
            profile. Joining is optional.
          </p>
          <ul className="space-y-1">
            <li>
              Members of your group see the messages you post, which messages you like, the name you chose to
              show, and when you joined. They never see your email, your check-ins, journal or anything else
              in the app.
            </li>
            <li>
              Moderators of your group can remove messages and remove people who break the group guidelines.
              When you report a message, moderators see the message and your reason, but not who reported it.
            </li>
            <li>
              Blocking someone hides their messages from you; they are not told. You can unblock them in
              Settings.
            </li>
            <li>
              You can delete any message you posted, or leave the group, at any time. Deleting your account
              also deletes every message you posted.
            </li>
            <li>The group is text only: no photos, and links are never turned into clickable links.</li>
          </ul>

          <H>When information leaves the app</H>
          <ul className="space-y-1">
            <li>
              <strong>Messages to your accountability contacts.</strong> When you tap "I Need Support" or
              "Request Check-In", AMP opens your phone's Messages app (or email app) with a message ready for
              you to review and send. It is sent from your own phone number or email account; AMP never sends
              it and keeps no copy. "I Need Support" includes a one-line summary of today's check-in, which
              you can edit before sending.
            </li>
            <li>
              <strong>Grounding Guide (AI).</strong> If you start a Grounding Guide session, the trigger log
              you started from and the messages you write are sent to our AI provider, Anthropic, solely to
              generate replies. We do not store these conversations.
            </li>
          </ul>

          <H>Your choices</H>
          <ul className="space-y-1">
            <li>Edit or delete journal entries, contacts and group messages at any time.</li>
            <li>Change how your name shows, or leave your group, in Settings.</li>
            <li>
              Delete your account in <strong>Settings → Delete Account & All Data</strong>. This permanently
              and immediately erases your account and every record linked to it.
            </li>
            <li>Turn daily reminders on or off in Settings, or in your phone's notification settings.</li>
          </ul>

          <H>Who this app is for</H>
          <p>
            AMP is intended for adults. It is a support tool, not a substitute for a pastor, counselor, or
            medical care.
          </p>
          <p>
            If you are in crisis in the U.S., call or text{' '}
            <a href="tel:988" className="font-medium text-primary underline">
              988
            </a>{' '}
            (Suicide & Crisis Lifeline) or call 911.
          </p>

          <H>Contact</H>
          <p>
            Questions or requests about your data:{' '}
            {contact ? (
              <a href={`mailto:${contact}`} className="font-medium text-primary underline">
                {contact}
              </a>
            ) : (
              'contact the ministry that provided this app.'
            )}
          </p>
        </article>
      </Screen>
    </div>
  )
}
