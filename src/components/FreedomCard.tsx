import { useState } from 'react'
import { useNavigate } from 'react-router'
import { format, parseISO } from 'date-fns'
import { Flame, HandHeart, PartyPopper, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DialogDescription, DialogTitle, Sheet, SheetContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useGroupStatus, useMyRoom, useShareMilestone } from '@/data/groupQueries'
import { useUpdateProfile } from '@/data/queries'
import type { Profile } from '@/data/types'
import { localDate } from '@/lib/dates'
import { daysOfFreedom, durationLabel, nextMilestone, previousMilestone, progressToNext } from '@/lib/freedom'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

/**
 * Days of freedom, for the recovery track. Private: only the person sees it,
 * unless they share a milestone with their group.
 */
export function FreedomCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [editing, setEditing] = useState(false)
  const today = localDate()

  if (profile.track !== 'men' || profile.freedom_hidden) return null

  const save = (
    patch: Partial<Pick<Profile, 'freedom_start' | 'freedom_best_days' | 'freedom_hidden'>>,
    done?: string,
  ) =>
    update.mutate(
      { id: profile.id, patch },
      {
        onSuccess: () => {
          hapticSuccess()
          if (done) toast.success(done)
          setEditing(false)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  if (!profile.freedom_start) {
    return (
      <Card id="freedom" className="scroll-mt-6 space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Flame className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">Freedom counter</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Count your days of freedom, one day at a time. Only you can see it.
            </p>
          </div>
        </div>
        {editing ? (
          <StartDateForm
            initial={today}
            max={today}
            busy={update.isPending}
            onCancel={() => setEditing(false)}
            onSave={(date) => save({ freedom_start: date }, 'Your freedom counter has started.')}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              disabled={update.isPending}
              onClick={() => save({ freedom_start: today }, 'Day 1. Walk in freedom today.')}
            >
              Start today
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setEditing(true)}>
              I started earlier
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => save({ freedom_hidden: true }, 'Hidden. You can turn it back on in Settings.')}
            >
              Not now
            </Button>
          </div>
        )}
      </Card>
    )
  }

  const days = daysOfFreedom(profile.freedom_start)
  const next = nextMilestone(days)
  const best = Math.max(profile.freedom_best_days, days)

  return (
    <Card id="freedom" className="scroll-mt-6 space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Flame className="size-3.5" aria-hidden="true" /> Freedom
          </p>
          {days === 0 ? (
            <p className="mt-1 font-display text-3xl font-semibold text-foreground">Day 1</p>
          ) : (
            <p className="mt-1 text-foreground">
              <span className="font-display text-4xl font-semibold">{days}</span>{' '}
              <span className="text-sm text-muted-foreground">{days === 1 ? 'day' : 'days'} of freedom</span>
            </p>
          )}
          <p className="mt-1 text-xs italic text-muted-foreground">
            “It is for freedom that Christ has set us free.” — Galatians 5:1
          </p>
        </div>
      </div>

      <RecentMilestone profile={profile} days={days} />

      <div className="space-y-1.5">
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`Progress to ${durationLabel(next)}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressToNext(days) * 100)}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressToNext(days) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {durationLabel(next - days)} to {durationLabel(next)}
          {best > days && ` · Longest: ${durationLabel(best)}`}
        </p>
      </div>
    </Card>
  )
}

function StartDateForm({
  initial,
  max,
  busy,
  onCancel,
  onSave,
}: {
  initial: string
  max: string
  busy: boolean
  onCancel: () => void
  onSave: (date: string) => void
}) {
  const [date, setDate] = useState(initial)
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (date && date <= max) onSave(date)
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">My current stretch of freedom began on</span>
        <Input type="date" value={date} max={max} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={busy || !date || date > max}>
          Save
        </Button>
      </div>
    </form>
  )
}

/**
 * For a week after a milestone: a quiet note on the counter, with a second
 * chance to share it (the celebration pop-up offers it first).
 */
function RecentMilestone({ profile, days }: { profile: Profile; days: number }) {
  const reached = previousMilestone(days)
  const room = useMyRoom()
  const status = useGroupStatus(room)
  const share = useShareMilestone(room)
  if (reached === 0 || days - reached >= 7) return null
  const inGroup = Boolean(status.data?.member)
  const shared = profile.freedom_shared >= reached

  return (
    <div className="flex items-start gap-3 rounded-xl bg-primary/10 p-4">
      <PartyPopper className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold text-foreground">
          {days === reached
            ? `${durationLabel(reached)} of freedom today!`
            : `You reached ${durationLabel(reached)}!`}
        </p>
        {shared ? (
          <p className="text-xs font-medium text-primary">Shared with your group.</p>
        ) : inGroup ? (
          <Button
            size="sm"
            disabled={share.isPending}
            onClick={() =>
              share.mutate(reached, {
                onSuccess: () => {
                  hapticSuccess()
                  toast.success('Shared with your group.')
                },
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
          >
            Share with my group
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Thank God for every one of them.</p>
        )}
      </div>
    </div>
  )
}

/** Small corner badge on Home: the day count. Tapping it scrolls to the full counter. */
export function FreedomBadge({ profile }: { profile: Profile }) {
  if (profile.track !== 'men' || profile.freedom_hidden || !profile.freedom_start) return null
  const days = daysOfFreedom(profile.freedom_start)
  return (
    <a
      href="#freedom"
      onClick={(e) => {
        e.preventDefault()
        document.getElementById('freedom')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
      aria-label={
        days === 0
          ? 'Day 1 of freedom. Show freedom counter'
          : `${days} days of freedom. Show freedom counter`
      }
      // A slim pill; the invisible ::after keeps a comfortable tap area.
      className="relative inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-primary/20 bg-card/90 py-1 pl-2 pr-2.5 text-xs shadow-xs transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-primary/5 active:scale-[0.98]"
    >
      <Flame className="size-3.5 text-primary" aria-hidden="true" />
      <span className="font-semibold text-foreground">{days === 0 ? 'Day 1' : days}</span>
      <span className="text-muted-foreground">
        {days === 0 ? 'of Freedom' : days === 1 ? 'Day of Freedom' : 'Days of Freedom'}
      </span>
    </a>
  )
}

/**
 * Settings → Freedom counter: start again (met with grace) or change the start
 * date. Kept out of Home so it isn't in front of people every day.
 */
export function FreedomControls({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [graceOpen, setGraceOpen] = useState(false)
  const today = localDate()

  const save = (patch: Partial<Pick<Profile, 'freedom_start' | 'freedom_best_days'>>, done: string) =>
    update.mutate(
      { id: profile.id, patch },
      {
        onSuccess: () => {
          hapticSuccess()
          toast.success(done)
          setEditing(false)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  if (!profile.freedom_start) {
    return editing ? (
      <StartDateForm
        initial={today}
        max={today}
        busy={update.isPending}
        onCancel={() => setEditing(false)}
        onSave={(date) => save({ freedom_start: date }, 'Your freedom counter has started.')}
      />
    ) : (
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={update.isPending}
          onClick={() => save({ freedom_start: today }, 'Day 1. Walk in freedom today.')}
        >
          Start today
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(true)}>
          Pick a start date
        </Button>
      </div>
    )
  }

  const days = daysOfFreedom(profile.freedom_start)
  const best = Math.max(profile.freedom_best_days, days)

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        {days === 0 ? 'Day 1' : `${durationLabel(days)} of freedom`}
        <span className="text-muted-foreground">
          {' '}
          · since {format(parseISO(profile.freedom_start), 'MMM d, yyyy')}
        </span>
        {best > days && (
          <span className="block text-xs text-muted-foreground">Longest: {durationLabel(best)}</span>
        )}
      </p>
      {editing ? (
        <StartDateForm
          initial={profile.freedom_start}
          max={today}
          busy={update.isPending}
          onCancel={() => setEditing(false)}
          onSave={(date) => save({ freedom_start: date }, 'Start date updated.')}
        />
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setGraceOpen(true)}>
            <RotateCcw aria-hidden="true" /> Start again
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(true)}>
            Edit start date
          </Button>
        </div>
      )}

      <Sheet open={graceOpen} onOpenChange={setGraceOpen}>
        <SheetContent>
          <DialogTitle className="px-2 pt-2 font-display text-lg">Grace for today</DialogTitle>
          <DialogDescription className="px-2 text-sm leading-relaxed">
            A slip doesn’t undo what God is doing in you. Be honest, reach out, and begin again.
          </DialogDescription>
          <blockquote className="mx-2 my-4 border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/80">
            “The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every
            morning.” — Lamentations 3:22–23
          </blockquote>
          {days > 0 && (
            <p className="px-2 text-sm text-muted-foreground">
              Your {durationLabel(days)} still count. They’re part of your story, and we’ll remember your
              longest stretch.
            </p>
          )}
          <div className="space-y-2 px-2 pb-2 pt-4">
            <Button
              className="w-full"
              disabled={update.isPending}
              onClick={() => {
                save(
                  { freedom_start: today, freedom_best_days: best },
                  'Day 1. His mercies are new this morning.',
                )
                setGraceOpen(false)
              }}
            >
              Start again today
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setGraceOpen(false)
                navigate('/home?help=1')
              }}
            >
              <HandHeart aria-hidden="true" /> Reach out to someone first
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
