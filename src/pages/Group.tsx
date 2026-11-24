import { Link } from 'react-router'
import { CalendarDays, Clock, Loader2, ShieldOff } from 'lucide-react'
import { paths } from '@/app/routes'
import { toast } from 'sonner'
import { NotificationsPrompt } from '@/components/NotificationsPrompt'
import { AboutYouPrompt } from '@/components/AboutYouPrompt'
import { GroupChat } from '@/components/group/GroupChat'
import { JoinGroup } from '@/components/group/JoinGroup'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GROUP_ROOMS } from '@/content/group'
import { useGroupStatus, useJoinGroup, useMyRoom } from '@/data/groupQueries'
import { errorMessage } from '@/lib/utils'
import { useProfile } from '@/data/queries'
import { useReadOnVisit } from '@/data/notificationQueries'
import type { NotificationKind } from '@/data/types'

/** The Group tab: a GroupMe-style chat for the person's own group. */
const GROUP_KINDS: NotificationKind[] = ['reply', 'join_approved', 'join_declined']

export default function Group() {
  const profile = useProfile()
  const room = useMyRoom()
  const status = useGroupStatus(room)
  // Being here is seeing replies and news about joining.
  useReadOnVisit(GROUP_KINDS)

  if (profile.isPending || (room && status.isPending)) {
    return (
      <div
        className="flex min-h-[60dvh] items-center justify-center"
        role="status"
        aria-label="Loading your group"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }
  if (!profile.data) return null

  if (!room) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-5 pb-6 pt-6">
        <h1 className="font-display text-xl font-semibold text-foreground">Your group</h1>
        <AboutYouPrompt
          profileId={profile.data.id}
          title="Which group is yours?"
          description="There are separate groups for men and women. Are you a man or a woman?"
        />
      </div>
    )
  }

  if (status.isError || !status.data) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-8 py-20 text-center">
        <p className="font-display text-lg font-semibold">We couldn't load your group</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button variant="outline" onClick={() => void status.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (status.data.removed) {
    return (
      <div className="mx-auto w-full max-w-lg px-5 pb-6 pt-6">
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <ShieldOff className="size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="font-display text-lg font-semibold">
            You've been removed from {GROUP_ROOMS[room].name}
          </h1>
          <p className="text-sm text-muted-foreground">
            A moderator removed you from this group. Everything else in the app still works. If you think this
            was a mistake, talk with your pastor or accountability partner.
          </p>
        </Card>
      </div>
    )
  }

  if (status.data.pending) return <Waiting roomName={GROUP_ROOMS[room].name} />
  if (status.data.declined) return <Declined room={room} />
  if (!status.data.member) return <JoinGroup room={room} profile={profile.data} />
  return <GroupChat room={room} member={status.data.member} />
}

/** Asked to join; a leader hasn't answered yet. */
function Waiting({ roomName }: { roomName: string }) {
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-5 pb-6 pt-6">
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-leader-soft text-leader">
          <Clock className="size-7" aria-hidden="true" />
        </span>
        <h1 className="font-display text-lg font-semibold">Your request has been sent</h1>
        <p className="text-sm text-muted-foreground">
          A leader will welcome you into {roomName} soon. Every new member is approved by a leader to keep the
          group safe.
        </p>
      </Card>
      <Link
        to={paths.calendar}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-card text-sm font-medium text-primary"
      >
        <CalendarDays className="size-4" aria-hidden="true" /> See your group's meeting calendar
      </Link>
      <NotificationsPrompt
        title="Know the moment you're in"
        description="Turn on notifications and we'll tell you when a leader approves you, even if AMP is closed."
        force
      />
    </div>
  )
}

/** A leader declined the request; they can ask again. */
function Declined({ room }: { room: NonNullable<ReturnType<typeof useMyRoom>> }) {
  const join = useJoinGroup(room)
  return (
    <div className="mx-auto w-full max-w-lg px-5 pb-6 pt-6">
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <h1 className="font-display text-lg font-semibold">Your request wasn't approved</h1>
        <p className="text-sm text-muted-foreground">
          A leader wasn't able to approve your request to join {GROUP_ROOMS[room].name}. If you think this was
          a mistake, talk with your pastor or a ministry leader, then ask again.
        </p>
        <Button
          variant="outline"
          disabled={join.isPending}
          onClick={() =>
            join.mutate(undefined, {
              onSuccess: () => toast.success('Request sent.'),
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          Ask again
        </Button>
      </Card>
    </div>
  )
}
