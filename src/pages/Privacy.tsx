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

const UPDATED = 'November 20, 2026'

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
            <li>Your email address, used only to sign you in with a one-time code.</li>
            <li>
              Your onboarding answers: your track, what brought you here, what you need most, and an optional
              display name.
            </li>
            <li>
              What you choose to record: daily check-ins, journal entries, trigger logs, and which grounding
              tools you use.
            </li>
            <li>Accountability contacts you add (name, email, phone, relationship).</li>
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

          <H>When information leaves the app</H>
          <ul className="space-y-1">
            <li>
              <strong>Emails to your accountability contacts.</strong> Only when you tap "I Need Support" or
              "Request Check-In", we email that contact through our email provider (Resend). The message
              includes your display name if you set one, and for "I Need Support", a one-line summary of
              today's check-in. Replies go to your email address.
            </li>
            <li>
              <strong>Grounding Guide (AI).</strong> If you start a Grounding Guide session, the trigger log
              you started from and the messages you write are sent to our AI provider, Anthropic, solely to
              generate replies. We do not store these conversations.
            </li>
          </ul>

          <H>Your choices</H>
          <ul className="space-y-1">
            <li>Edit or delete journal entries and contacts at any time.</li>
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
