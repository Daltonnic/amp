import { useState } from 'react'
import { ShieldCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { NameFields, namePartsOf, profileNamePatch } from '@/components/NameFields'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GROUP_GUIDELINES, GROUP_ROOMS } from '@/content/group'
import { groupChat } from '@/data/groupChat'
import { useJoinGroup } from '@/data/groupQueries'
import { useUpdateProfile } from '@/data/queries'
import type { GroupRoomId, Profile } from '@/data/types'
import { publicName } from '@/lib/names'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

/** First visit: what the group is, how your name will show, and the guidelines. */
export function JoinGroup({ room, profile }: { room: GroupRoomId; profile: Profile }) {
  const info = GROUP_ROOMS[room]
  const [name, setName] = useState(() => namePartsOf(profile))
  const [agreed, setAgreed] = useState(false)
  const updateProfile = useUpdateProfile()
  const join = useJoinGroup(room)
  const busy = updateProfile.isPending || join.isPending
  const shown = publicName(name)

  const submit = async () => {
    try {
      const patch = profileNamePatch(name)
      const original = profileNamePatch(namePartsOf(profile))
      if (JSON.stringify(patch) !== JSON.stringify(original)) {
        await updateProfile.mutateAsync({ id: profile.id, patch })
      }
      await join.mutateAsync()
      hapticSuccess()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-5 pb-6 pt-6">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">{info.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{info.description}</p>
        </div>
      </header>

      <Card className="flex items-start gap-3 border-primary/15 bg-primary/5 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm text-foreground/80">
          Only members of {info.name} can see this group. What you share stays inside it.
        </p>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-medium text-foreground">How your name will show</h2>
        <NameFields value={name} onChange={setName} />
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-medium text-foreground">Group guidelines</h2>
        <ol className="space-y-3">
          {GROUP_GUIDELINES.map((g, i) => (
            <li key={g.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{g.title}</span>
                <span className="block text-sm text-muted-foreground">{g.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="size-4 accent-[hsl(var(--primary))]"
          />
          <span className="text-sm font-medium text-foreground">I agree to follow these guidelines</span>
        </label>
      </Card>

      {!groupChat.live && (
        <p className="text-center text-xs text-muted-foreground">
          This is a preview on this device. Messages are only shared when you're signed in online.
        </p>
      )}

      <Button size="lg" className="w-full" disabled={!agreed || !shown || busy} onClick={() => void submit()}>
        {busy ? 'Joining…' : 'Join the group'}
      </Button>
    </div>
  )
}
