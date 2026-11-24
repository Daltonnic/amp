import { useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Check, Crown, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, LeaderBadge } from '@/components/group/Avatar'
import { Screen } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { GROUP_ROOMS } from '@/content/group'
import {
  useIsLeader,
  useLeaderPeople,
  useLeaders,
  useMyUserId,
  useReviewRequest,
  useSetLeader,
} from '@/data/groupQueries'
import type { LeaderPerson } from '@/data/types'
import { hapticSuccess } from '@/lib/native'
import { cn, errorMessage } from '@/lib/utils'

const STATUS_LABEL: Record<LeaderPerson['member_status'], string> = {
  none: 'Not in a group',
  pending: 'Waiting for approval',
  member: 'Member',
  left: 'Left the group',
  declined: 'Request declined',
  removed: 'Removed',
}

/** The name each person chose to show their group (leaders never see emails or real names). */
const nameOf = (p: LeaderPerson) => p.shown_name || 'No name chosen yet'
const signedUp = (p: LeaderPerson) => `Signed up ${format(new Date(p.created_at), 'MMM d, yyyy')}`
const groupOf = (p: LeaderPerson) =>
  p.room ? GROUP_ROOMS[p.room].name : p.track ? 'Hasn’t said man or woman yet' : 'Hasn’t finished setup'

type Tab = 'requests' | 'people' | 'leaders'

/** For leaders: approve new members, see everyone, and choose other leaders. */
export default function Leaders() {
  const isLeader = useIsLeader()
  const leaders = useLeaders()
  const people = useLeaderPeople(isLeader)
  const [tab, setTab] = useState<Tab | null>(null)

  if (leaders.isPending) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center" role="status" aria-label="Loading">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }
  if (!isLeader) {
    return (
      <Screen>
        <Card className="p-8 text-center">
          <h1 className="font-display text-lg font-semibold">Leaders only</h1>
          <p className="mt-1 text-sm text-muted-foreground">This page is for ministry leaders.</p>
        </Card>
      </Screen>
    )
  }

  const all = people.data ?? []
  const requests = all
    .filter((p) => p.member_status === 'pending')
    .sort((a, b) => (a.requested_at ?? '').localeCompare(b.requested_at ?? ''))
  const current: Tab = tab ?? (requests.length > 0 ? 'requests' : 'people')

  return (
    <Screen className="space-y-5">
      <header className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-leader text-leader-foreground">
          <Crown className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Leaders</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Welcome new members and care for the groups.</p>
        </div>
      </header>

      <Tabs value={current} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="requests" className="flex-1">
            Requests
            {requests.length > 0 && (
              <span className="ml-1.5 rounded-full bg-leader px-1.5 text-[11px] leading-5 text-leader-foreground">
                {requests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="people" className="flex-1">
            People
          </TabsTrigger>
          <TabsTrigger value="leaders" className="flex-1">
            Leaders
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {people.isPending ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : people.isError ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn’t load people. Check your connection.</p>
          <Button variant="outline" onClick={() => void people.refetch()}>
            Try again
          </Button>
        </Card>
      ) : current === 'requests' ? (
        <Requests requests={requests} />
      ) : current === 'people' ? (
        <People people={all} />
      ) : (
        <LeaderList people={all.filter((p) => p.is_leader)} />
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Leaders approve new members for every group and can make other people leaders. In the group they
        belong to, leaders can also remove messages, remove people and review reports. Each group stays
        private: leaders only read the group they’re in.
      </p>
    </Screen>
  )
}

function Requests({ requests }: { requests: LeaderPerson[] }) {
  if (requests.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="font-medium text-foreground">No one is waiting</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New requests show up here, and leaders get a notification when someone asks to join.
        </p>
      </Card>
    )
  }
  return (
    <ul className="space-y-3" aria-label="Join requests">
      {requests.map((p) => (
        <li key={p.user_id}>
          <RequestCard person={p} />
        </li>
      ))}
    </ul>
  )
}

function RequestCard({ person: p }: { person: LeaderPerson }) {
  const review = useReviewRequest()
  const [confirmDecline, setConfirmDecline] = useState(false)
  const decide = (approve: boolean) =>
    review.mutate(
      { userId: p.user_id, approve },
      {
        onSuccess: () => {
          hapticSuccess()
          toast.success(approve ? `${nameOf(p)} is in ${groupOf(p)}.` : 'Request declined.')
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  return (
    <Card className="space-y-3 border-leader/30 p-4">
      <div className="flex items-start gap-3">
        <Avatar userId={p.user_id} name={nameOf(p)} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{nameOf(p)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Asked to join <span className="font-medium text-foreground">{groupOf(p)}</span>
            {p.requested_at && ` · ${formatDistanceToNow(new Date(p.requested_at), { addSuffix: true })}`}
          </p>
        </div>
      </div>
      {confirmDecline ? (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDecline(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={review.isPending}
            onClick={() => decide(false)}
          >
            Decline request
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-leader text-leader-foreground hover:bg-leader/90"
            disabled={review.isPending}
            onClick={() => decide(true)}
          >
            <Check aria-hidden="true" /> Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={review.isPending}
            onClick={() => setConfirmDecline(true)}
          >
            <X aria-hidden="true" /> Decline
          </Button>
        </div>
      )}
    </Card>
  )
}

function People({ people }: { people: LeaderPerson[] }) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) => [nameOf(p), groupOf(p)].some((v) => v.toLowerCase().includes(q)))
  }, [people, query])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label="Search people"
          placeholder="Search by name or group"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {people.length} {people.length === 1 ? 'person has' : 'people have'} an account.
      </p>
      <ul className="space-y-2" aria-label="People">
        {shown.map((p) => (
          <li key={p.user_id}>
            <PersonRow person={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PersonRow({ person: p }: { person: LeaderPerson }) {
  const setLeader = useSetLeader()
  const [confirm, setConfirm] = useState(false)
  return (
    <Card className={cn('space-y-3 p-4', p.is_leader && 'border-leader/40 bg-leader-soft/60')}>
      <div className="flex items-start gap-3">
        <Avatar userId={p.user_id} name={nameOf(p)} leader={p.is_leader} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
            <span className="truncate">{nameOf(p)}</span>
            {p.is_leader && <LeaderBadge />}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {groupOf(p)} ·{' '}
            <span className="font-medium text-foreground">{STATUS_LABEL[p.member_status]}</span>
          </p>
          <p className="text-xs text-muted-foreground">{signedUp(p)}</p>
        </div>
      </div>
      {!p.is_leader &&
        (confirm ? (
          <div className="space-y-2 rounded-lg bg-leader-soft p-3">
            <p className="text-sm text-foreground">
              Make {nameOf(p)} a leader? They’ll be able to approve members, make other leaders, and moderate
              their group.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-leader text-leader-foreground hover:bg-leader/90"
                disabled={setLeader.isPending}
                onClick={() =>
                  setLeader.mutate(
                    { userId: p.user_id, make: true },
                    {
                      onSuccess: () => {
                        hapticSuccess()
                        toast.success(`${nameOf(p)} is now a leader.`)
                        setConfirm(false)
                      },
                      onError: (err) => toast.error(errorMessage(err)),
                    },
                  )
                }
              >
                <Crown aria-hidden="true" /> Make leader
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="border-leader/50 text-leader"
            onClick={() => setConfirm(true)}
          >
            <Crown aria-hidden="true" /> Make leader
          </Button>
        ))}
    </Card>
  )
}

function LeaderList({ people }: { people: LeaderPerson[] }) {
  const me = useMyUserId()
  const setLeader = useSetLeader()
  const [confirming, setConfirming] = useState<string | null>(null)
  const onlyOne = people.length <= 1
  return (
    <ul className="space-y-2" aria-label="Current leaders">
      {people.map((p) => (
        <li key={p.user_id}>
          <Card className="space-y-3 border-leader/40 bg-leader-soft/60 p-4">
            <div className="flex items-center gap-3">
              <Avatar userId={p.user_id} name={nameOf(p)} leader className="size-10 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                  <span className="truncate">{nameOf(p)}</span>
                  {p.user_id === me && (
                    <span className="text-xs font-normal text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{signedUp(p)}</p>
              </div>
              {!onlyOne && confirming !== p.user_id && (
                <Button variant="ghost" size="sm" onClick={() => setConfirming(p.user_id)}>
                  Step down
                </Button>
              )}
            </div>
            {confirming === p.user_id && (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={setLeader.isPending}
                  onClick={() =>
                    setLeader.mutate(
                      { userId: p.user_id, make: false },
                      {
                        onSuccess: () => {
                          toast.success(
                            p.user_id === me
                              ? 'You’re no longer a leader.'
                              : `${nameOf(p)} is no longer a leader.`,
                          )
                          setConfirming(null)
                        },
                        onError: (err) => toast.error(errorMessage(err)),
                      },
                    )
                  }
                >
                  {p.user_id === me ? 'Step down myself' : `Step ${nameOf(p)} down`}
                </Button>
              </div>
            )}
          </Card>
        </li>
      ))}
      {onlyOne && (
        <p className="px-1 text-xs text-muted-foreground">There must always be at least one leader.</p>
      )}
    </ul>
  )
}
