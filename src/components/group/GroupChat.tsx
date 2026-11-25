import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp, CalendarDays, Flag, Heart, Loader2, Users, X } from 'lucide-react'
import { paths } from '@/app/routes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/controls'
import { Textarea } from '@/components/ui/input'
import { GROUP_ROOMS } from '@/content/group'
import { groupChat } from '@/data/groupChat'
import {
  useGroupBlocks,
  useGroupMembers,
  useGroupMessage,
  useGroupMessages,
  useGroupReports,
  useLeaders,
  useMarkRead,
  useSendMessage,
  useToggleLike,
} from '@/data/groupQueries'
import type { GroupMember, GroupMessage, GroupRoomId } from '@/data/types'
import { buildThread } from '@/lib/groupThread'
import { useKeyboardOpen } from '@/lib/keyboard'
import { hapticTap } from '@/lib/native'
import { clearGroupNotifications } from '@/lib/push'
import { cn, errorMessage } from '@/lib/utils'
import { Avatar, LeaderBadge } from './Avatar'
import { MembersSheet, MessageActionsSheet, ReportsSheet } from './sheets'

const MAX_LENGTH = 2000
const NEAR_BOTTOM_PX = 160

const isNearBottom = () =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX
const scrollToBottom = (smooth: boolean) =>
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })

export function GroupChat({ room, member }: { room: GroupRoomId; member: GroupMember }) {
  const me = member.user_id
  const info = GROUP_ROOMS[room]
  const leadersQ = useLeaders()
  const leaders = useMemo(() => leadersQ.data ?? new Set<string>(), [leadersQ.data])
  // Leaders moderate the group they're in.
  const isModerator = member.role === 'moderator' || leaders.has(me)
  const keyboardOpen = useKeyboardOpen()

  const messagesQ = useGroupMessages(room, true)
  const membersQ = useGroupMembers(room, true)
  const blocksQ = useGroupBlocks(true)
  const reportsQ = useGroupReports(room, isModerator)
  const { mutate: markRead } = useMarkRead(room)
  const { mutate: likeMutate } = useToggleLike(room)

  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null)
  const [selected, setSelected] = useState<GroupMessage | null>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [seenAt, setSeenAt] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const members = useMemo(() => new Map((membersQ.data ?? []).map((m) => [m.user_id, m])), [membersQ.data])
  const blocked = useMemo(() => new Set(blocksQ.data ?? []), [blocksQ.data])
  const nameOf = useCallback(
    (userId: string) => (userId === me ? 'You' : (members.get(userId)?.display_name ?? 'Former member')),
    [me, members],
  )
  // Pages are newest-first; the thread reads oldest-first.
  const messages = useMemo(
    () => (messagesQ.data?.pages.flat() ?? []).filter((m) => !blocked.has(m.user_id)).reverse(),
    [messagesQ.data, blocked],
  )
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const thread = useMemo(() => buildThread(messages), [messages])
  const activeCount = (membersQ.data ?? []).filter((m) => !m.left_at).length
  const hasText = messages.some((m) => m.kind === 'text')
  const newest = messages[messages.length - 1]
  const openReports = new Set((reportsQ.data ?? []).map((r) => r.message_id)).size
  const unseen = messages.filter((m) => m.kind === 'text' && m.user_id !== me && m.created_at > seenAt).length

  // --- Scrolling --------------------------------------------------------------
  const newestRef = useRef<GroupMessage | undefined>(undefined)
  const shownNewestId = useRef<string | null>(null)
  const initialized = useRef(false)
  const wasAtBottom = useRef(true)
  const restore = useRef<{ height: number; y: number } | null>(null)

  useEffect(() => {
    newestRef.current = newest
  }, [newest])

  useEffect(() => {
    const onScroll = () => {
      const bottom = isNearBottom()
      // Everything up to now was seen while you were at the bottom.
      if (bottom || wasAtBottom.current) setSeenAt(newestRef.current?.created_at ?? '')
      wasAtBottom.current = bottom
      setAtBottom(bottom)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Open at the newest message; follow new ones if you're already at the bottom.
  useLayoutEffect(() => {
    if (!messagesQ.isSuccess) return
    if (!initialized.current) {
      initialized.current = true
      shownNewestId.current = newest?.id ?? null
      scrollToBottom(false)
      return
    }
    if (!newest || newest.id === shownNewestId.current) return
    const wasNearBottom = isNearBottom() || shownNewestId.current === null
    shownNewestId.current = newest.id
    if (newest.user_id === me || wasNearBottom) scrollToBottom(true)
  }, [messagesQ.isSuccess, newest, me])

  // Keep your place when older messages load above.
  const pageCount = messagesQ.data?.pages.length ?? 0
  useLayoutEffect(() => {
    const r = restore.current
    if (!r) return
    restore.current = null
    window.scrollTo({ top: r.y + (document.documentElement.scrollHeight - r.height) })
  }, [pageCount])

  const topRef = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messagesQ
  useEffect(() => {
    const el = topRef.current
    if (!el || !hasNextPage || isFetchingNextPage) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !initialized.current || restore.current) return
        restore.current = { height: document.documentElement.scrollHeight, y: window.scrollY }
        void fetchNextPage()
      },
      { rootMargin: '300px 0px 0px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // --- Read state --------------------------------------------------------------
  useEffect(() => {
    if (document.visibilityState !== 'visible') return
    markRead()
    void clearGroupNotifications()
  }, [newest?.id, markRead])
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      markRead()
      void clearGroupNotifications()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [markRead])

  const onLike = useCallback(
    (id: string) => {
      hapticTap()
      likeMutate(id, { onError: (err) => toast.error(errorMessage(err)) })
    },
    [likeMutate],
  )

  const startReply = useCallback((m: GroupMessage) => {
    setReplyTo(m)
    requestAnimationFrame(() => composerRef.current?.focus())
  }, [])

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col"
      // Fill the screen down to the tab bar, so the message bar always sits right on it.
      // (With the keyboard open there's no tab bar; the message bar sits right on the keyboard.)
      style={
        keyboardOpen
          ? { minHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))', marginBottom: -16 }
          : {
              minHeight:
                'calc(100dvh - env(safe-area-inset-top, 0px) - var(--tabbar-height) - env(safe-area-inset-bottom, 0px))',
            }
      }
    >
      {/* Covers the status bar area so scrolled messages don't show behind it. */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-background"
      />

      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <button
          type="button"
          onClick={() => setMembersOpen(true)}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 text-left transition-colors hover:bg-muted/50"
          aria-label={`${info.name}, ${activeCount} ${activeCount === 1 ? 'member' : 'members'}. Show members`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-semibold leading-tight text-foreground">
              {info.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {membersQ.isSuccess ? `${activeCount} ${activeCount === 1 ? 'member' : 'members'}` : ' '}
            </span>
          </span>
        </button>
        <Link
          to={paths.calendar}
          aria-label="Group calendar"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-muted/50"
        >
          <CalendarDays className="size-5" aria-hidden="true" />
        </Link>
        {isModerator && (
          <Button variant="outline" size="sm" onClick={() => setReportsOpen(true)}>
            <Flag aria-hidden="true" /> Reports
            {openReports > 0 && (
              <span className="ml-0.5 rounded-full bg-destructive px-1.5 text-[11px] leading-5 text-destructive-foreground">
                {openReports}
              </span>
            )}
          </Button>
        )}
      </header>

      {!groupChat.live && (
        <p className="mx-3 mt-3 rounded-lg bg-muted/70 px-3 py-2 text-center text-xs text-muted-foreground">
          Preview on this device. Messages are shared when you're signed in online.
        </p>
      )}

      <div role="log" aria-label={`${info.name} messages`} className="flex flex-1 flex-col px-3 pb-3 pt-2">
        <div ref={topRef} />
        {isFetchingNextPage && (
          <div className="flex justify-center py-3" role="status" aria-label="Loading earlier messages">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        {messagesQ.isSuccess && !hasNextPage && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            This is the beginning of {info.name}.
          </p>
        )}
        {messagesQ.isPending && (
          <div className="space-y-4 py-4">
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
          </div>
        )}
        {messagesQ.isError && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">We couldn't load the conversation.</p>
            <Button variant="outline" onClick={() => void messagesQ.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {messagesQ.isSuccess && !hasText && (
          <div className="my-auto px-6 py-10 text-center">
            <p className="font-display text-lg font-semibold text-foreground">Be the first to say hello</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share where you are today, a prayer request, or a verse that's helping you.
            </p>
          </div>
        )}

        {thread.map((item) => {
          if (item.type === 'day') {
            return (
              <div key={item.key} className="my-3 flex justify-center">
                <span className="rounded-full bg-muted/80 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
            )
          }
          if (item.type === 'system') {
            return (
              <p key={item.key} className="my-2 text-center text-xs text-muted-foreground">
                {nameOf(item.message.user_id)} {item.message.body}
              </p>
            )
          }
          const m = item.message
          const author = members.get(m.user_id)
          return (
            <MessageRow
              key={item.key}
              message={m}
              first={item.first}
              last={item.last}
              me={me}
              authorName={nameOf(m.user_id)}
              authorIsModerator={author?.role === 'moderator'}
              authorIsLeader={leaders.has(m.user_id)}
              reply={m.reply_to ? (byId.get(m.reply_to) ?? null) : null}
              nameOf={nameOf}
              blocked={blocked}
              onOpen={setSelected}
              onLike={onLike}
            />
          )
        })}
      </div>

      {unseen > 0 && !atBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg"
          style={{
            bottom: `calc(${keyboardOpen ? '0px' : 'var(--tabbar-height)'} + env(safe-area-inset-bottom, 0px) + 5.5rem)`,
          }}
        >
          <ArrowDown className="size-4" aria-hidden="true" />
          {unseen} new {unseen === 1 ? 'message' : 'messages'}
        </button>
      )}

      <Composer
        room={room}
        replyTo={replyTo}
        replyName={replyTo ? nameOf(replyTo.user_id) : ''}
        onCancelReply={() => setReplyTo(null)}
        onSent={() => setReplyTo(null)}
        keyboardOpen={keyboardOpen}
        textareaRef={composerRef}
      />

      <MessageActionsSheet
        room={room}
        message={selected ? (byId.get(selected.id) ?? selected) : null}
        me={me}
        isModerator={isModerator}
        nameOf={nameOf}
        onReply={startReply}
        onClose={() => setSelected(null)}
      />
      <MembersSheet
        room={room}
        open={membersOpen}
        onOpenChange={setMembersOpen}
        members={membersQ.data ?? []}
        me={me}
        isModerator={isModerator}
        leaders={leaders}
        blocked={blocked}
      />
      {isModerator && (
        <ReportsSheet room={room} open={reportsOpen} onOpenChange={setReportsOpen} nameOf={nameOf} />
      )}
    </div>
  )
}

const MessageRow = memo(function MessageRow({
  message: m,
  first,
  last,
  me,
  authorName,
  authorIsModerator,
  authorIsLeader,
  reply,
  nameOf,
  blocked,
  onOpen,
  onLike,
}: {
  message: GroupMessage
  first: boolean
  last: boolean
  me: string
  authorName: string
  authorIsModerator: boolean
  authorIsLeader: boolean
  reply: GroupMessage | null
  nameOf: (userId: string) => string
  blocked: Set<string>
  onOpen: (m: GroupMessage) => void
  onLike: (id: string) => void
}) {
  const mine = m.user_id === me
  const pending = m.id.startsWith('temp-')
  const deleted = Boolean(m.deleted_at)
  const likes = m.liked_by.length
  const iLiked = m.liked_by.includes(me)
  const time = format(new Date(m.created_at), 'h:mm a')
  const deletedText =
    m.deleted_by === null
      ? 'Hidden after reports'
      : m.deleted_by === m.user_id
        ? 'This message was deleted'
        : 'Removed by a moderator'

  return (
    <div
      id={`msg-${m.id}`}
      className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start', first ? 'mt-3' : 'mt-0.5')}
    >
      {!mine &&
        (first ? (
          <Avatar userId={m.user_id} name={authorName} leader={authorIsLeader} className="mt-5" />
        ) : (
          <span className="w-8 shrink-0" />
        ))}
      <div className={cn('flex min-w-0 max-w-[80%] flex-col', mine ? 'items-end' : 'items-start')}>
        {!mine && first && (
          <p
            className={cn(
              'mb-0.5 flex items-center gap-1.5 px-1 text-xs font-medium',
              authorIsLeader ? 'text-leader' : 'text-muted-foreground',
            )}
          >
            {authorName}
            {authorIsLeader && <LeaderBadge />}
            {authorIsModerator && !authorIsLeader && (
              <span className="rounded bg-primary/10 px-1 py-px text-[10px] font-semibold text-primary">
                Moderator
              </span>
            )}
          </p>
        )}
        <div className={cn('flex max-w-full items-center gap-1', mine && 'flex-row-reverse')}>
          <button
            type="button"
            disabled={pending}
            onClick={() => onOpen(m)}
            aria-label={`${mine ? 'Your message' : `Message from ${authorName}`} at ${time}. Show options`}
            className={cn(
              'min-w-0 max-w-full rounded-2xl px-3.5 py-2 text-left text-[15px] leading-snug transition-opacity',
              deleted
                ? 'border border-dashed text-muted-foreground italic'
                : mine
                  ? 'bg-primary text-primary-foreground'
                  : authorIsLeader
                    ? 'border border-leader/50 bg-leader-soft text-foreground'
                    : 'border bg-card text-card-foreground',
              mine && last && !deleted && 'rounded-br-md',
              !mine && last && !deleted && 'rounded-bl-md',
              pending && 'opacity-60',
            )}
          >
            {m.reply_to && !deleted && (
              <ReplyQuote id={m.reply_to} known={reply} nameOf={nameOf} blocked={blocked} mine={mine} />
            )}
            <span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {deleted ? deletedText : m.body}
            </span>
          </button>
          {!deleted && !pending && (!mine || likes > 0) && (
            <button
              type="button"
              onClick={() => onLike(m.id)}
              aria-pressed={iLiked}
              aria-label={`${iLiked ? 'Unlike' : 'Like'}${likes ? ` (${likes} ${likes === 1 ? 'like' : 'likes'})` : ''}`}
              className="flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-0.5 rounded-full px-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              <Heart
                className={cn('size-4', iLiked ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground/50')}
                aria-hidden="true"
              />
              {likes > 0 && <span className={cn(iLiked && 'text-rose-500')}>{likes}</span>}
            </button>
          )}
        </div>
        {last && (
          <p className="mt-0.5 px-1 text-[11px] text-muted-foreground">{pending ? 'Sending…' : time}</p>
        )}
      </div>
    </div>
  )
})

function ReplyQuote({
  id,
  known,
  nameOf,
  blocked,
  mine,
}: {
  id: string
  known: GroupMessage | null
  nameOf: (userId: string) => string
  blocked: Set<string>
  mine: boolean
}) {
  const fetched = useGroupMessage(id, !known)
  const original = known ?? fetched.data ?? null
  const text = !original
    ? 'An earlier message'
    : blocked.has(original.user_id)
      ? 'A hidden message'
      : original.deleted_at
        ? 'A deleted message'
        : original.body
  return (
    <span
      className={cn(
        'mb-1.5 block border-l-2 pl-2 text-xs',
        mine
          ? 'border-primary-foreground/50 text-primary-foreground/85'
          : 'border-primary/50 text-muted-foreground',
      )}
    >
      {original && !blocked.has(original.user_id) && (
        <span className="block font-semibold">{nameOf(original.user_id)}</span>
      )}
      <span className="line-clamp-2 block">{text}</span>
    </span>
  )
}

function Composer({
  room,
  replyTo,
  replyName,
  onCancelReply,
  onSent,
  keyboardOpen,
  textareaRef,
}: {
  room: GroupRoomId
  replyTo: GroupMessage | null
  replyName: string
  onCancelReply: () => void
  onSent: () => void
  keyboardOpen: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
}) {
  const [text, setText] = useState('')
  const send = useSendMessage(room)
  const canSend = text.trim().length > 0 && text.length <= MAX_LENGTH

  const resize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }
  useLayoutEffect(resize)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    const body = text
    setText('')
    onSent()
    hapticTap()
    send.mutate(
      { body, replyTo: replyTo?.id ?? null },
      {
        onError: (err) => {
          toast.error(errorMessage(err))
          setText((current) => current || body)
        },
      },
    )
  }

  return (
    <form
      onSubmit={submit}
      // Same surface as the tab bar, so the two read as one bar.
      className="sticky z-20 border-t bg-card/95 px-3 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-card/85"
      style={{ bottom: keyboardOpen ? 0 : 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))' }}
    >
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/70 py-1.5 pl-3 pr-1 text-xs">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">Replying to {replyName}</span>
            <span className="block truncate text-muted-foreground">{replyTo.body}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // On computers, Enter sends and Shift+Enter adds a line. On phones
            // the return key adds a line and the button sends.
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              window.matchMedia('(pointer: fine)').matches
            ) {
              e.preventDefault()
              submit()
            }
          }}
          maxLength={MAX_LENGTH}
          aria-label="Message the group"
          placeholder="Message the group"
          className="max-h-40 min-h-11 resize-none rounded-2xl py-2.5"
        />
        <Button
          type="submit"
          size="icon"
          className="shrink-0 rounded-full"
          disabled={!canSend}
          aria-label="Send"
          // Keep the keyboard open on phones after sending.
          onMouseDown={(e) => e.preventDefault()}
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </Button>
      </div>
      {text.length > MAX_LENGTH - 200 && (
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </p>
      )}
    </form>
  )
}
