import { Link, useSearchParams } from 'react-router'
import {
  BookOpen,
  Circle,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  HandHeart,
  Mail,
  MessageSquare,
  Minus,
  Shield,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { paths } from '@/app/routes'
import { AboutYouPrompt } from '@/components/AboutYouPrompt'
import { FreedomBadge, FreedomCard } from '@/components/FreedomCard'
import { InstallPrompt } from '@/components/InstallPrompt'
import { NotificationsPrompt } from '@/components/NotificationsPrompt'
import { PullToRefresh } from '@/components/PullToRefresh'
import { WeeklyChart, type ChartSeries } from '@/components/WeeklyChart'
import { Card } from '@/components/ui/card'
import { DialogDescription, DialogTitle, Sheet, SheetContent } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/controls'
import { DAILY_FOCUS, ENCOURAGEMENTS } from '@/content/home'
import { useContacts, useProfile, useTodayCheckIn, useWeekCheckIns } from '@/data/queries'
import type { AccountabilityContact, CheckIn, Track } from '@/data/types'
import { dailyPick, greeting } from '@/lib/dates'
import { computeTrend, mostFrequentEmotion, type Trend } from '@/lib/insights'
import { hapticTap } from '@/lib/native'
import { channelFor, reachOut } from '@/lib/support'
import { cn } from '@/lib/utils'

export default function Home() {
  const profile = useProfile()
  const today = useTodayCheckIn()
  const week = useWeekCheckIns()
  const contacts = useContacts()
  // ?help=1 opens "I Need Support" (also the "Help Me Now" app shortcut).
  const [params, setParams] = useSearchParams()
  const helpOpen = params.get('help') === '1'
  const setHelpOpen = (open: boolean) => setParams(open ? { help: '1' } : {}, { replace: true })

  if (profile.isPending || !profile.data) {
    return (
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const track = profile.data.track
  const name = profile.data.display_name.trim()

  return (
    <PullToRefresh
      onRefresh={() => Promise.all([profile.refetch(), today.refetch(), week.refetch(), contacts.refetch()])}
    >
      <div className="mx-auto max-w-lg space-y-6 px-5 pb-4 pt-8">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {greeting()}
              {name ? `, ${name}` : ''}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-semibold text-foreground">The Journey</h1>
          </div>
          <FreedomBadge profile={profile.data} />
        </header>
        {!profile.data.gender && <AboutYouPrompt profileId={profile.data.id} />}
        <NotificationsPrompt />
        <InstallPrompt />
        <QuickActions onHelp={() => setHelpOpen(true)} />
        <Encouragement track={track} />
        <WeeklyInsights track={track} />
        <TodayCheckInCard checkIn={today.data ?? null} />
        <TodaysFocus track={track} />
        <FreedomCard profile={profile.data} />
      </div>
      <SupportSheet open={helpOpen} onOpenChange={setHelpOpen} todayCheckIn={today.data ?? null} />
    </PullToRefresh>
  )
}

function Encouragement({ track }: { track: Track }) {
  const now = new Date()
  const message = dailyPick(ENCOURAGEMENTS[track], now.getDate() + now.getMonth())
  return (
    <Card className="border-primary/10 bg-primary/5 p-5">
      <p className="text-center text-sm font-medium leading-relaxed text-primary">{message}</p>
    </Card>
  )
}

const QUICK_LINKS: { label: string; to: string; icon: LucideIcon; color: string }[] = [
  {
    label: 'Check In',
    to: paths.checkIn,
    icon: ClipboardCheck,
    color: 'bg-secondary text-secondary-foreground',
  },
  { label: 'Journal', to: paths.journal, icon: BookOpen, color: 'bg-accent text-accent-foreground' },
  {
    label: 'Log Trigger',
    to: `${paths.triggers}?view=new`,
    icon: CircleAlert,
    color: 'bg-muted text-muted-foreground',
  },
]

const tileClass =
  'flex size-14 items-center justify-center rounded-2xl transition-transform group-active:scale-95'

function QuickActions({ onHelp }: { onHelp: () => void }) {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-4 gap-3">
      <button
        type="button"
        onClick={() => {
          hapticTap()
          onHelp()
        }}
        className="group flex flex-col items-center gap-2"
      >
        <span className={cn(tileClass, 'bg-primary text-primary-foreground')}>
          <Shield className="size-5" aria-hidden="true" />
        </span>
        <span className="text-center text-xs font-medium leading-tight text-foreground">Help Me Now</span>
      </button>
      {QUICK_LINKS.map(({ label, to, icon: Icon, color }) => (
        <Link key={label} to={to} className="group flex flex-col items-center gap-2">
          <span className={cn(tileClass, color)}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="text-center text-xs font-medium leading-tight text-foreground">{label}</span>
        </Link>
      ))}
    </nav>
  )
}

/**
 * "Help Me Now": the people you trust, each one tap from a ready-to-send
 * text (or email, for a contact without a mobile number).
 */
function SupportSheet({
  open,
  onOpenChange,
  todayCheckIn,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  todayCheckIn: CheckIn | null
}) {
  const contacts = useContacts()
  const reachable = (contacts.data ?? []).filter((c) => !c.id.startsWith('temp-') && channelFor(c))

  const send = (contact: AccountabilityContact) => {
    hapticTap()
    onOpenChange(false)
    reachOut(contact, 'support', todayCheckIn)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 px-2 pt-2 text-base">
          <HandHeart className="size-5 text-primary" aria-hidden="true" /> I Need Support
        </DialogTitle>
        <DialogDescription className="px-2 text-sm">
          {reachable.length > 0
            ? 'Tap someone to text them. A message will open, ready for you to send.'
            : 'Add the people you trust, so reaching out is one tap away.'}
        </DialogDescription>

        {contacts.isPending ? (
          <div className="space-y-2 py-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : reachable.length > 0 ? (
          <ul className="space-y-1 py-3" aria-label="Support people">
            {reachable.map((c) => {
              const text = channelFor(c) === 'text'
              const Icon = text ? MessageSquare : Mail
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => send(c)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{c.name}</span>
                      {c.relationship && (
                        <span className="block text-xs text-muted-foreground">{c.relationship}</span>
                      )}
                    </span>
                    <span className="text-xs font-medium text-primary">{text ? 'Text' : 'Email'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="py-4">
            <Link
              to={paths.accountability}
              onClick={() => onOpenChange(false)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              <HandHeart className="size-4" aria-hidden="true" /> Add a support person
            </Link>
          </div>
        )}

        <div className="space-y-1 border-t pb-1 pt-3 text-center">
          {reachable.length > 0 && (
            <Link
              to={paths.accountability}
              onClick={() => onOpenChange(false)}
              className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-primary"
            >
              Add or change support people
            </Link>
          )}
          <p className="text-xs text-muted-foreground">
            In danger right now? Call or text{' '}
            <a href="tel:988" className="font-semibold text-primary underline">
              988
            </a>
            , or call 911.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

const TREND_UI: Record<Trend, { icon: LucideIcon; color: string }> = {
  rising: { icon: TrendingUp, color: 'text-destructive' },
  declining: { icon: TrendingDown, color: 'text-success' },
  stable: { icon: Minus, color: 'text-primary' },
}

function WeeklyInsights({ track }: { track: Track }) {
  const week = useWeekCheckIns()
  const days = week.data ?? []
  const logged = days.filter((d) => d.hasData).length

  if (logged === 0) {
    return (
      <Card className="p-5">
        <p className="mb-1 text-sm font-semibold text-foreground">Weekly Insights</p>
        <p className="text-xs text-muted-foreground">
          Complete daily check-ins to see your emotional patterns here.
        </p>
      </Card>
    )
  }

  const trend = computeTrend(days, track)
  const metric = track === 'spouse' ? 'Intensity' : 'Temptation'
  const trendLabel =
    trend === 'stable' ? 'Holding steady' : trend === 'rising' ? `${metric} rising` : `${metric} declining`
  const TrendIcon = trend ? TREND_UI[trend].icon : null
  const emotion = mostFrequentEmotion(days)

  const series: ChartSeries[] =
    track === 'spouse'
      ? [{ key: 'intensity', name: 'Intensity', color: 'var(--color-primary)' }]
      : [
          { key: 'stress', name: 'Stress', color: 'var(--color-primary)' },
          { key: 'temptation', name: 'Temptation', color: 'var(--color-destructive)', dashed: true },
        ]

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Weekly Insights</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{logged}/7 days logged</p>
        </div>
        {trend && TrendIcon && (
          <p className={cn('flex items-center gap-1 text-xs font-medium', TREND_UI[trend].color)}>
            <TrendIcon className="size-3.5" aria-hidden="true" />
            {trendLabel}
          </p>
        )}
      </div>
      <WeeklyChart data={days} series={series} />
      <div className="flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            {s.dashed ? (
              <span className="h-0.5 w-2.5 rounded" style={{ background: s.color }} />
            ) : (
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            )}
            <span className="text-muted-foreground">{s.name}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-destructive/50" />
          <span className="text-muted-foreground">High-risk zone</span>
        </div>
      </div>
      {emotion && (
        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            Most frequent emotion this week: <span className="font-semibold text-foreground">{emotion}</span>
          </p>
        </div>
      )}
    </Card>
  )
}

function TodayCheckInCard({ checkIn }: { checkIn: CheckIn | null }) {
  const done = Boolean(checkIn)
  const feeling = checkIn
    ? [...checkIn.emotions, checkIn.custom_emotion.trim()].filter(Boolean).join(', ')
    : ''
  return (
    <Link to={paths.checkIn} className="group block">
      <Card
        className={cn(
          'flex items-center gap-3 p-4 transition-colors',
          done ? 'border-primary/20 bg-primary/5' : 'hover:border-primary/30',
        )}
      >
        {done ? (
          <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {done ? "Today's check-in complete" : 'How are you today?'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {done ? `Feeling: ${feeling}` : 'Take a moment to check in with yourself'}
          </p>
        </div>
        {!done && (
          // The whole card is the link; this is its visible call to action.
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-transform group-active:scale-95">
            <ClipboardCheck className="size-3.5" aria-hidden="true" /> Check In
          </span>
        )}
      </Card>
    </Link>
  )
}

function TodaysFocus({ track }: { track: Track }) {
  const focus = dailyPick(DAILY_FOCUS[track], new Date().getDate())
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="size-4 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wider text-primary">Today's Focus</span>
      </div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{focus.scripture}</p>
      <blockquote className="mb-4 font-display text-base italic leading-relaxed text-foreground">
        "{focus.text}"
      </blockquote>
      <p className="text-sm leading-relaxed text-muted-foreground">{focus.reflection}</p>
    </Card>
  )
}
