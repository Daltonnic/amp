import { Loader2, ShieldOff } from 'lucide-react'
import { AboutYouPrompt } from '@/components/AboutYouPrompt'
import { GroupChat } from '@/components/group/GroupChat'
import { JoinGroup } from '@/components/group/JoinGroup'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GROUP_ROOMS } from '@/content/group'
import { useGroupStatus, useMyRoom } from '@/data/groupQueries'
import { useProfile } from '@/data/queries'

/** The Group tab: a GroupMe-style chat for the person's own group. */
export default function Group() {
  const profile = useProfile()
  const room = useMyRoom()
  const status = useGroupStatus(room)

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

  if (!status.data.member) return <JoinGroup room={room} profile={profile.data} />
  return <GroupChat room={room} member={status.data.member} />
}
