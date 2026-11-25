import { useState } from 'react'
import { Flame } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { GROUP_ROOMS } from '@/content/group'
import { useGroupStatus, useMyRoom, useShareMilestone } from '@/data/groupQueries'
import { useUpdateProfile } from '@/data/queries'
import type { Profile } from '@/data/types'
import { durationLabel, milestoneToCelebrate, milestoneVerse } from '@/lib/freedom'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

const CONFETTI_COLORS = ['bg-primary', 'bg-moderator-shield', 'bg-rose-400', 'bg-sky-400', 'bg-emerald-400']

/**
 * Celebrates a freedom milestone once, the next time Home opens after it's
 * reached, and offers to share it with the group (or keep it private).
 */
export function MilestoneCelebration({ profile }: { profile: Profile }) {
  const milestone = milestoneToCelebrate(profile)
  const [open, setOpen] = useState(true)
  const update = useUpdateProfile()
  const room = useMyRoom()
  const status = useGroupStatus(room)
  const share = useShareMilestone(room)

  if (!milestone || !open) return null
  const member = status.data?.member ?? null
  const canShare = Boolean(member && room) && milestone > profile.freedom_shared
  const verse = milestoneVerse(milestone)
  const label = durationLabel(milestone)

  // Seen: don't celebrate this one again.
  const finish = () => {
    setOpen(false)
    update.mutate({ id: profile.id, patch: { freedom_celebrated: milestone } })
  }

  return (
    <Dialog open onOpenChange={(next) => !next && finish()}>
      <DialogContent className="overflow-hidden text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-80 motion-reduce:hidden"
          aria-hidden="true"
        >
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className={`absolute top-0 block h-2.5 w-1.5 animate-confetti rounded-sm ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
              style={{
                left: `${(i * 37 + 11) % 100}%`,
                animationDelay: `${(i % 7) * 110}ms`,
                animationDuration: `${1.8 + (i % 5) * 0.25}s`,
              }}
            />
          ))}
        </div>

        <span className="mx-auto flex size-20 animate-pop-in items-center justify-center rounded-full bg-gradient-to-br from-primary to-moderator-shield text-primary-foreground shadow-lg">
          <Flame className="size-10" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <DialogTitle className="font-display text-2xl font-semibold">{label} of freedom!</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Every one of these days is a gift from God. This is worth celebrating.
          </DialogDescription>
        </div>
        <blockquote className="rounded-xl bg-muted/60 px-4 py-3 text-sm italic text-foreground/80">
          “{verse.text}”
          <span className="mt-1 block text-xs not-italic text-muted-foreground">{verse.ref}</span>
        </blockquote>

        {canShare && member && room ? (
          <div className="space-y-2">
            <Button
              className="w-full"
              disabled={share.isPending}
              onClick={() =>
                share.mutate(milestone, {
                  onSuccess: () => {
                    hapticSuccess()
                    toast.success('Shared with your group. They’ll be cheering you on.')
                    setOpen(false)
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Share with {GROUP_ROOMS[room].name}
            </Button>
            <p className="text-xs text-muted-foreground">
              Your group will see: “{member.display_name} reached {label} of freedom.”
            </p>
            <Button variant="ghost" className="w-full" onClick={finish}>
              Keep it private
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" onClick={finish}>
              Thank you, Lord
            </Button>
            {room && !member && (
              <p className="text-xs text-muted-foreground">
                Once you’re in your group, you can share milestones like this with them.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
