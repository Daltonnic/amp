import { useState } from 'react'
import { Flame, HandHeart, PartyPopper, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DialogDescription, DialogTitle, Sheet, SheetContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useGroupStatus, useMyRoom, useSendMessage } from '@/data/groupQueries'
import { useUpdateProfile } from '@/data/queries'
import type { Profile } from '@/data/types'
import { localDate } from '@/lib/dates'
import {
  daysOfFreedom,
  durationLabel,
  isMilestone,
  milestoneShareText,
  nextMilestone,
  progressToNext,
} from '@/lib/freedom'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

const SHARED_KEY = 'amp.freedom.shared'

function wasShared(key: string) {
  try {
    return localStorage.getItem(SHARED_KEY) === key
  } catch {
    return false
  }
}

/**
 * Days of freedom, for the recovery track. Private: only the person sees it,
 * unless they share a milestone with their group.
 */
export function FreedomCard({ profile, onReachOut }: { profile: Profile; onReachOut: () => void }) {
  const update = useUpdateProfile()
  const [editing, setEditing] = useState(false)
  const [graceOpen, setGraceOpen] = useState(false)
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
      <Card className="space-y-4 p-5">
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
  const celebrate = days > 0 && isMilestone(days)
  const best = Math.max(profile.freedom_best_days, days)

  return (
    <Card className="space-y-4 p-5">
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

      {celebrate && <Celebration days={days} shareKey={`${profile.freedom_start}:${days}`} />}

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
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditing(true)}>
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
                onReachOut()
              }}
            >
              <HandHeart aria-hidden="true" /> Reach out to someone first
            </Button>
          </div>
        </SheetContent>
      </Sheet>
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

/** A milestone today: celebrate, and offer to share it with the group. */
function Celebration({ days, shareKey }: { days: number; shareKey: string }) {
  const room = useMyRoom()
  const status = useGroupStatus(room)
  const send = useSendMessage(room)
  const [shared, setShared] = useState(() => wasShared(shareKey))
  const inGroup = Boolean(status.data?.member)

  return (
    <div className="flex items-start gap-3 rounded-xl bg-primary/10 p-4">
      <PartyPopper className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold text-foreground">{durationLabel(days)} of freedom!</p>
        <p className="text-xs text-muted-foreground">
          Thank God for every one of them. This is worth celebrating.
        </p>
        {inGroup && !shared && (
          <Button
            size="sm"
            disabled={send.isPending}
            onClick={() =>
              send.mutate(
                { body: milestoneShareText(days), replyTo: null },
                {
                  onSuccess: () => {
                    try {
                      localStorage.setItem(SHARED_KEY, shareKey)
                    } catch {
                      /* ignore */
                    }
                    setShared(true)
                    hapticSuccess()
                    toast.success('Shared with your group.')
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                },
              )
            }
          >
            Share with my group
          </Button>
        )}
        {shared && <p className="text-xs font-medium text-primary">Shared with your group.</p>}
      </div>
    </div>
  )
}
