import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CalendarClock,
  ChevronRight,
  Crown,
  Info,
  MessageCircle,
  MessagesSquare,
  PartyPopper,
  UserCheck,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { paths } from '@/app/routes'
import { PageHeader, Screen, SectionLabel } from '@/components/layout'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/controls'
import { GROUP_ROOMS } from '@/content/group'
import { useGroupBadge, useMyRoom, useMyUserId } from '@/data/groupQueries'
import {
  notificationKeys,
  useMarkNotificationsRead,
  useNotifications,
  useRemoveNotification,
} from '@/data/notificationQueries'
import type { AppNotification, NotificationKind } from '@/data/types'
import { meetingWhen, timeAgo } from '@/lib/notifications'
import { cn } from '@/lib/utils'

const LOOK: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  reply: { icon: MessageCircle, tone: 'bg-primary/10 text-primary' },
  join_request: { icon: UserPlus, tone: 'bg-leader-soft text-leader' },
  join_handled: { icon: UserCheck, tone: 'bg-muted text-muted-foreground' },
  join_approved: { icon: PartyPopper, tone: 'bg-primary/10 text-primary' },
  join_declined: { icon: Info, tone: 'bg-muted text-muted-foreground' },
  leader: { icon: Crown, tone: 'bg-leader-soft text-leader' },
  meeting: { icon: CalendarClock, tone: 'bg-primary/10 text-primary' },
}

/** Everything AMP has told you: replies, your group, leader news and meeting reminders. */
export default function Notifications() {
  const list = useNotifications()
  const { mutate: markRead } = useMarkNotificationsRead()
  const remove = useRemoveNotification()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const me = useMyUserId()
  const room = useMyRoom()
  const groupUnread = useGroupBadge()

  // New ones stay highlighted while you're here, and count as read once you leave.
  useEffect(
    () => () => {
      const rows = qc.getQueryData<AppNotification[]>(notificationKeys.list(me))
      if (rows?.some((n) => !n.read_at)) markRead({})
    },
    [qc, me, markRead],
  )

  const rows = list.data ?? []
  const unread = rows.filter((n) => !n.read_at)
  const earlier = rows.filter((n) => n.read_at)

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead({ ids: [n.id] })
    navigate(n.url)
  }

  const item = (n: AppNotification) => {
    const { icon: Icon, tone } = LOOK[n.kind] ?? LOOK.reply
    const detail = n.kind === 'meeting' && n.occurrence_start ? meetingWhen(n.occurrence_start) : n.body
    return (
      <li key={n.id}>
        <Card
          className={cn(
            'relative flex items-start gap-3 p-0 transition-colors',
            !n.read_at && 'border-primary/30 bg-primary/[0.04]',
          )}
        >
          <button
            type="button"
            onClick={() => open(n)}
            className="flex min-h-16 min-w-0 flex-1 items-start gap-3 rounded-xl py-3.5 pl-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
          >
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', tone)}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn('block text-sm text-foreground', n.read_at ? 'font-medium' : 'font-semibold')}
              >
                {!n.read_at && <span className="sr-only">New: </span>}
                {n.title}
              </span>
              {detail && (
                <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{detail}</span>
              )}
              <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
            </span>
            {!n.read_at && (
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => remove.mutate(n.id)}
            aria-label={`Remove “${n.title}”`}
            className="mr-1 mt-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </Card>
      </li>
    )
  }

  return (
    <Screen>
      <PageHeader
        title="Notifications"
        action={
          unread.length > 0 ? (
            <button
              type="button"
              onClick={() => markRead({})}
              className="min-h-11 px-1 text-sm font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {room && groupUnread > 0 && (
          <Link
            to={paths.group}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-3.5 transition-colors hover:bg-primary/10"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessagesSquare className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {groupUnread === 1
                  ? '1 new message'
                  : `${groupUnread > 99 ? '99+' : groupUnread} new messages`}
              </span>
              <span className="block text-sm text-muted-foreground">{GROUP_ROOMS[room].name}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}

        {list.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : list.isError ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Couldn’t load your notifications. Check your connection.
          </Card>
        ) : rows.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-6" aria-hidden="true" />
            </span>
            <p className="font-display text-lg font-semibold text-foreground">You’re all caught up</p>
            <p className="text-sm text-muted-foreground">
              Replies to you, meeting reminders and news about your group will show up here.
            </p>
          </Card>
        ) : (
          <>
            {unread.length > 0 && (
              <section aria-labelledby="new-heading">
                <SectionLabel>
                  <span id="new-heading">New</span>
                </SectionLabel>
                <ul className="space-y-2">{unread.map(item)}</ul>
              </section>
            )}
            {earlier.length > 0 && (
              <section aria-labelledby="earlier-heading">
                <SectionLabel>
                  <span id="earlier-heading">Earlier</span>
                </SectionLabel>
                <ul className="space-y-2">{earlier.map(item)}</ul>
              </section>
            )}
          </>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Choose which ones reach your phone in{' '}
          <Link to={`${paths.settings}#notifications`} className="font-medium text-primary hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>
    </Screen>
  )
}
