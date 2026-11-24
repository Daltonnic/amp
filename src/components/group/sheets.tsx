import { useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { Ban, Copy, Flag, Heart, LogOut, Reply, Trash2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/controls'
import { DialogDescription, DialogTitle, Sheet, SheetContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { GROUP_ROOMS } from '@/content/group'
import {
  useBlockMember,
  useDeleteMessage,
  useGroupReports,
  useLeaveGroup,
  useRemoveMember,
  useReportMessage,
  useResolveReport,
  useToggleLike,
} from '@/data/groupQueries'
import type { GroupMember, GroupMessage, GroupReport, GroupRoomId } from '@/data/types'
import { hapticSuccess } from '@/lib/native'
import { cn, errorMessage } from '@/lib/utils'
import { Avatar, LeaderBadge } from './Avatar'

const REPORT_REASONS = [
  'Explicit or sexual content',
  'Shaming or harassment',
  'Pursuing someone or asking for private contact',
  'Spam or off-topic',
  'Something else',
]

function ActionRow({
  icon,
  children,
  onClick,
  destructive,
  disabled,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left font-medium transition-colors hover:bg-muted disabled:opacity-50',
        destructive ? 'text-destructive' : 'text-foreground',
      )}
    >
      <span className={cn('[&_svg]:size-5', destructive ? 'text-destructive' : 'text-primary')}>{icon}</span>
      {children}
    </button>
  )
}

type Mode = 'menu' | 'report' | 'delete' | 'block' | 'remove'

/** What you can do with one message. */
export function MessageActionsSheet({
  room,
  message,
  me,
  isModerator,
  nameOf,
  onReply,
  onClose,
}: {
  room: GroupRoomId
  message: GroupMessage | null
  me: string
  isModerator: boolean
  nameOf: (userId: string) => string
  onReply: (m: GroupMessage) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>('menu')
  const [reason, setReason] = useState(REPORT_REASONS[0]!)
  const [details, setDetails] = useState('')
  const like = useToggleLike(room)
  const del = useDeleteMessage(room)
  const report = useReportMessage()
  const block = useBlockMember()
  const remove = useRemoveMember(room)

  const close = () => {
    onClose()
    setMode('menu')
    setDetails('')
    setReason(REPORT_REASONS[0]!)
  }
  if (!message) return <Sheet open={false} />

  const mine = message.user_id === me
  const author = nameOf(message.user_id)
  const deleted = Boolean(message.deleted_at)
  const iLiked = message.liked_by.includes(me)
  const likedBy = message.liked_by.map(nameOf)
  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action()
      hapticSuccess()
      toast.success(done)
      close()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="sr-only">{mine ? 'Your message' : `Message from ${author}`}</DialogTitle>
        <DialogDescription className="sr-only">Choose what to do with this message.</DialogDescription>

        <div className="mb-2 rounded-xl bg-muted/60 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">{mine ? 'You' : author}</p>
          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-sm text-foreground">
            {deleted ? 'This message was deleted.' : message.body}
          </p>
          {likedBy.length > 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="size-3 fill-rose-500 text-rose-500" aria-hidden="true" />
              Liked by {likedBy.join(', ')}
            </p>
          )}
        </div>

        {mode === 'menu' && (
          <div className="pb-2">
            {!deleted && (
              <>
                <ActionRow
                  icon={<Heart className={cn(iLiked && 'fill-rose-500 text-rose-500')} />}
                  onClick={() => {
                    like.mutate(message.id)
                    close()
                  }}
                >
                  {iLiked ? 'Unlike' : 'Like'}
                </ActionRow>
                <ActionRow
                  icon={<Reply />}
                  onClick={() => {
                    onReply(message)
                    close()
                  }}
                >
                  Reply
                </ActionRow>
                <ActionRow
                  icon={<Copy />}
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(message.body)
                      .then(() => toast.success('Copied.'))
                      .catch(() => toast.error('Couldn’t copy on this device.'))
                    close()
                  }}
                >
                  Copy text
                </ActionRow>
              </>
            )}
            {!mine && !deleted && (
              <ActionRow icon={<Flag />} onClick={() => setMode('report')}>
                Report message
              </ActionRow>
            )}
            {!mine && (
              <ActionRow icon={<Ban />} onClick={() => setMode('block')}>
                Block {author}
              </ActionRow>
            )}
            {(mine || isModerator) && !deleted && (
              <ActionRow icon={<Trash2 />} destructive onClick={() => setMode('delete')}>
                Delete message
              </ActionRow>
            )}
            {isModerator && !mine && (
              <ActionRow icon={<UserX />} destructive onClick={() => setMode('remove')}>
                Remove {author} from the group
              </ActionRow>
            )}
          </div>
        )}

        {mode === 'report' && (
          <form
            className="space-y-3 pb-2"
            onSubmit={(e) => {
              e.preventDefault()
              const text = details.trim() ? `${reason}: ${details.trim()}` : reason
              void run(
                () => report.mutateAsync({ id: message.id, reason: text }),
                'Thank you. A moderator will review it.',
              )
            }}
          >
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-foreground">
                Why are you reporting this?
              </legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  <span className="text-sm text-foreground">{r}</span>
                </label>
              ))}
            </fieldset>
            <Textarea
              aria-label="Anything else moderators should know (optional)"
              placeholder="Anything else moderators should know (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
              className="min-h-20 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {author} won’t know who reported it. Messages reported by three people are hidden until a
              moderator reviews them.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setMode('menu')}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={report.isPending}>
                Send report
              </Button>
            </div>
          </form>
        )}

        {mode === 'delete' && (
          <Confirm
            text={
              mine
                ? 'Delete this message for everyone? This can’t be undone.'
                : `Delete ${author}’s message for everyone? This can’t be undone.`
            }
            action="Delete"
            busy={del.isPending}
            onBack={() => setMode('menu')}
            onConfirm={() => void run(() => del.mutateAsync(message.id), 'Message deleted.')}
          />
        )}

        {mode === 'block' && (
          <Confirm
            text={`You won’t see messages from ${author} anymore. They won’t be told. You can unblock them in Settings.`}
            action={`Block ${author}`}
            busy={block.isPending}
            onBack={() => setMode('menu')}
            onConfirm={() =>
              void run(
                () => block.mutateAsync({ userId: message.user_id, block: true }),
                `You won’t see messages from ${author}.`,
              )
            }
          />
        )}

        {mode === 'remove' && (
          <RemoveMember
            name={author}
            busy={remove.isPending}
            onBack={() => setMode('menu')}
            onConfirm={(why) =>
              void run(
                () => remove.mutateAsync({ userId: message.user_id, reason: why }),
                `${author} was removed from the group.`,
              )
            }
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function Confirm({
  text,
  action,
  busy,
  onBack,
  onConfirm,
}: {
  text: string
  action: string
  busy: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <div className="space-y-4 pb-2">
      <p className="text-sm text-foreground">{text}</p>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Cancel
        </Button>
        <Button variant="destructive" className="flex-1" disabled={busy} onClick={onConfirm}>
          {action}
        </Button>
      </div>
    </div>
  )
}

function RemoveMember({
  name,
  busy,
  onBack,
  onConfirm,
}: {
  name: string
  busy: boolean
  onBack: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-3 pb-2">
      <p className="text-sm text-foreground">
        Remove {name} from the group? They won’t be able to see it or rejoin.
      </p>
      <Textarea
        aria-label="Reason (only moderators see this)"
        placeholder="Reason (only moderators see this)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        className="min-h-20 resize-none"
      />
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Cancel
        </Button>
        <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => onConfirm(reason)}>
          Remove
        </Button>
      </div>
    </div>
  )
}

/** Who's in the group, plus block/unblock, moderator removal and leaving. */
export function MembersSheet({
  room,
  open,
  onOpenChange,
  members,
  me,
  isModerator,
  leaders,
  blocked,
}: {
  room: GroupRoomId
  open: boolean
  onOpenChange: (open: boolean) => void
  members: GroupMember[]
  me: string
  isModerator: boolean
  leaders: Set<string>
  blocked: Set<string>
}) {
  const info = GROUP_ROOMS[room]
  const block = useBlockMember()
  const leave = useLeaveGroup(room)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [removing, setRemoving] = useState<GroupMember | null>(null)
  const remove = useRemoveMember(room)
  const active = members
    .filter((m) => !m.left_at)
    .sort(
      (a, b) =>
        Number(b.user_id === me) - Number(a.user_id === me) ||
        Number(leaders.has(b.user_id)) - Number(leaders.has(a.user_id)) ||
        Number(b.role === 'moderator') - Number(a.role === 'moderator') ||
        a.display_name.localeCompare(b.display_name),
    )

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setConfirmLeave(false)
          setRemoving(null)
        }
      }}
    >
      <SheetContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="px-1 font-display text-lg font-semibold">{info.name}</DialogTitle>
        <DialogDescription className="px-1 text-sm text-muted-foreground">
          {active.length} {active.length === 1 ? 'member' : 'members'} · {info.description}
        </DialogDescription>

        {removing ? (
          <div className="pt-4">
            <RemoveMember
              name={removing.display_name}
              busy={remove.isPending}
              onBack={() => setRemoving(null)}
              onConfirm={(reason) =>
                remove.mutate(
                  { userId: removing.user_id, reason },
                  {
                    onSuccess: () => {
                      toast.success(`${removing.display_name} was removed from the group.`)
                      setRemoving(null)
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  },
                )
              }
            />
          </div>
        ) : (
          <ul className="divide-y py-2" aria-label="Members">
            {active.map((m) => {
              const isMe = m.user_id === me
              const isBlocked = blocked.has(m.user_id)
              return (
                <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                  <Avatar
                    userId={m.user_id}
                    name={m.display_name}
                    leader={leaders.has(m.user_id)}
                    className="size-10 text-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                      <span className="truncate">{m.display_name}</span>
                      {isMe && <Badge variant="secondary">You</Badge>}
                      {leaders.has(m.user_id) && <LeaderBadge />}
                      {m.role === 'moderator' && !leaders.has(m.user_id) && <Badge>Moderator</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {format(new Date(m.joined_at), 'MMM yyyy')}
                    </p>
                  </div>
                  {!isMe && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          block.mutate(
                            { userId: m.user_id, block: !isBlocked },
                            { onError: (err) => toast.error(errorMessage(err)) },
                          )
                        }
                      >
                        {isBlocked ? 'Unblock' : 'Block'}
                      </Button>
                      {isModerator && m.role !== 'moderator' && !leaders.has(m.user_id) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setRemoving(m)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!removing &&
          (confirmLeave ? (
            <Confirm
              text="Leave the group? You can join again any time from the Group tab."
              action="Leave group"
              busy={leave.isPending}
              onBack={() => setConfirmLeave(false)}
              onConfirm={() =>
                leave.mutate(undefined, {
                  onSuccess: () => {
                    onOpenChange(false)
                    toast.success('You left the group.')
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            />
          ) : (
            <div className="pb-2 pt-2">
              <ActionRow icon={<LogOut />} destructive onClick={() => setConfirmLeave(true)}>
                Leave group
              </ActionRow>
            </div>
          ))}
      </SheetContent>
    </Sheet>
  )
}

/** Moderators: open reports, grouped by message. */
export function ReportsSheet({
  room,
  open,
  onOpenChange,
  nameOf,
}: {
  room: GroupRoomId
  open: boolean
  onOpenChange: (open: boolean) => void
  nameOf: (userId: string) => string
}) {
  const reports = useGroupReports(room, true)
  const resolve = useResolveReport(room)
  const del = useDeleteMessage(room)
  const remove = useRemoveMember(room)
  const groups = new Map<string, GroupReport[]>()
  for (const r of reports.data ?? []) groups.set(r.message_id, [...(groups.get(r.message_id) ?? []), r])

  const act = (p: Promise<unknown>, done: string) =>
    p.then(() => toast.success(done)).catch((err: unknown) => toast.error(errorMessage(err)))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="px-1 font-display text-lg font-semibold">Reports</DialogTitle>
        <DialogDescription className="px-1 text-sm text-muted-foreground">
          Messages members have reported. Reporters stay anonymous.
        </DialogDescription>
        {groups.size === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No open reports. Thank you for keeping watch.
          </p>
        ) : (
          <ul className="space-y-3 py-3">
            {[...groups.values()].map((list) => {
              const first = list[0]!
              const author = nameOf(first.author_id)
              return (
                <li key={first.message_id} className="space-y-3 rounded-xl border p-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {author} · reported {list.length} {list.length === 1 ? 'time' : 'times'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                      {first.body_snapshot}
                    </p>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {list.map((r) => (
                      <li key={r.id}>“{r.reason || 'No reason given'}”</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void act(del.mutateAsync(first.message_id), 'Message removed.')}
                    >
                      Remove message
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() =>
                        void act(
                          remove.mutateAsync({ userId: first.author_id, reason: first.reason }),
                          `${author} was removed from the group.`,
                        )
                      }
                    >
                      Remove {author}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void act(Promise.all(list.map((r) => resolve.mutateAsync(r.id))), 'Report dismissed.')
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  )
}
