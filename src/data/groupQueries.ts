import { useEffect } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { roomFor } from '@/content/group'
import { mergeLatest } from '@/lib/groupThread'
import { useAuth } from '@/lib/auth'
import { groupChat, type GroupStatus } from './groupChat'
import { useProfile } from './queries'
import type { GroupMember, GroupMessage, GroupRoomId } from './types'

export const MESSAGE_PAGE = 40

export const groupKeys = {
  all: ['group'] as const,
  status: (room: GroupRoomId) => ['group', 'status', room] as const,
  members: (room: GroupRoomId) => ['group', 'members', room] as const,
  messages: (room: GroupRoomId) => ['group', 'messages', room] as const,
  message: (id: string) => ['group', 'message', id] as const,
  unread: (room: GroupRoomId) => ['group', 'unread', room] as const,
  blocks: ['group', 'blocks'] as const,
  reports: (room: GroupRoomId) => ['group', 'reports', room] as const,
  leaders: ['leaders'] as const,
  people: ['leaders', 'people'] as const,
}

type Pages = InfiniteData<GroupMessage[], string | undefined>

const newestFirst = (a: GroupMessage, b: GroupMessage) => (a.created_at < b.created_at ? 1 : -1)

/** Adds or replaces a message in the loaded pages. */
function upsertMessage(qc: QueryClient, room: GroupRoomId, message: GroupMessage) {
  qc.setQueryData<Pages>(groupKeys.messages(room), (data) => {
    if (!data) return data
    let found = false
    const pages = data.pages.map((page) =>
      page.map((m) => {
        if (m.id !== message.id) return m
        found = true
        return message
      }),
    )
    if (!found) pages[0] = [message, ...(pages[0] ?? [])].sort(newestFirst)
    return { ...data, pages }
  })
}

function removeMessage(qc: QueryClient, room: GroupRoomId, id: string) {
  qc.setQueryData<Pages>(groupKeys.messages(room), (data) =>
    data ? { ...data, pages: data.pages.map((page) => page.filter((m) => m.id !== id)) } : data,
  )
}

function findMessage(qc: QueryClient, room: GroupRoomId, id: string): GroupMessage | undefined {
  return qc
    .getQueryData<Pages>(groupKeys.messages(room))
    ?.pages.flat()
    .find((m) => m.id === id)
}

export function useMyUserId(): string | null {
  const { state } = useAuth()
  return state.status === 'signed-in' ? state.userId : null
}

/** The group this person belongs in, or null until we know man or woman. */
export function useMyRoom(): GroupRoomId | null {
  const profile = useProfile()
  return profile.data ? roomFor(profile.data.track, profile.data.gender) : null
}

export function useGroupStatus(room: GroupRoomId | null) {
  return useQuery({
    queryKey: groupKeys.status(room ?? 'men-recovery'),
    queryFn: () => groupChat.status(room!),
    enabled: Boolean(room),
  })
}

export function useJoinGroup(room: GroupRoomId | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => groupChat.join(),
    onSuccess: (member) => {
      const active = member.status === 'active'
      qc.setQueryData<GroupStatus>(groupKeys.status(member.room), {
        member: active ? member : null,
        removed: false,
        pending: member.status === 'pending',
        declined: false,
      })
      if (room) void qc.invalidateQueries({ queryKey: groupKeys.members(room) })
      void qc.invalidateQueries({ queryKey: groupKeys.messages(member.room) })
    },
  })
}

export function useLeaveGroup(room: GroupRoomId | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => groupChat.leave(),
    onSuccess: () => {
      if (!room) return
      qc.setQueryData<GroupStatus>(groupKeys.status(room), {
        member: null,
        removed: false,
        pending: false,
        declined: false,
      })
      qc.removeQueries({ queryKey: groupKeys.messages(room) })
      qc.setQueryData(groupKeys.unread(room), 0)
    },
  })
}

export function useGroupMembers(room: GroupRoomId | null, enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.members(room ?? 'men-recovery'),
    queryFn: () => groupChat.members(room!),
    enabled: Boolean(room) && enabled,
    staleTime: 60_000,
  })
}

export function useGroupMessages(room: GroupRoomId | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: groupKeys.messages(room ?? 'men-recovery'),
    queryFn: ({ pageParam }) => groupChat.messages(room!, { before: pageParam, limit: MESSAGE_PAGE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length < MESSAGE_PAGE ? undefined : last[last.length - 1]!.created_at),
    enabled: Boolean(room) && enabled,
    // Live updates keep this fresh; a refetch would reload every page.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

/** A message that isn't in the loaded pages (e.g. the original of an old reply). */
export function useGroupMessage(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.message(id ?? ''),
    queryFn: () => groupChat.message(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 5 * 60_000,
  })
}

export function useGroupBlocks(enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.blocks,
    queryFn: () => groupChat.blocks(),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useBlockMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, block }: { userId: string; block: boolean }) =>
      block ? groupChat.block(userId) : groupChat.unblock(userId),
    onMutate: ({ userId, block }) => {
      const previous = qc.getQueryData<string[]>(groupKeys.blocks) ?? []
      qc.setQueryData<string[]>(
        groupKeys.blocks,
        block ? [...new Set([...previous, userId])] : previous.filter((u) => u !== userId),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(groupKeys.blocks, ctx?.previous),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['group', 'unread'] }),
  })
}

/** Unread messages from others, for the tab badge. */
export function useGroupUnread(room: GroupRoomId | null, member: GroupMember | null, blocks: string[]) {
  const me = useMyUserId()
  return useQuery({
    queryKey: groupKeys.unread(room ?? 'men-recovery'),
    queryFn: () => groupChat.unreadCount(room!, member!.last_read_at, [me!, ...blocks]),
    enabled: Boolean(room && member && me),
    refetchInterval: 60_000,
  })
}

export function useMarkRead(room: GroupRoomId | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => groupChat.markRead(),
    onMutate: () => {
      if (!room) return
      qc.setQueryData(groupKeys.unread(room), 0)
      qc.setQueryData<GroupStatus>(groupKeys.status(room), (s) =>
        s?.member ? { ...s, member: { ...s.member, last_read_at: new Date().toISOString() } } : s,
      )
    },
  })
}

export function useSendMessage(room: GroupRoomId | null) {
  const qc = useQueryClient()
  const me = useMyUserId()
  return useMutation({
    mutationFn: ({ body, replyTo }: { body: string; replyTo: string | null }) =>
      groupChat.send(body, replyTo),
    onMutate: ({ body, replyTo }) => {
      if (!room || !me) return undefined
      const temp: GroupMessage = {
        id: `temp-${crypto.randomUUID()}`,
        room,
        user_id: me,
        kind: 'text',
        body: body.trim(),
        reply_to: replyTo,
        liked_by: [],
        created_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
      }
      upsertMessage(qc, room, temp)
      return { tempId: temp.id }
    },
    onError: (_e, _v, ctx) => {
      if (room && ctx) removeMessage(qc, room, ctx.tempId)
    },
    onSuccess: (message, _v, ctx) => {
      if (!room) return
      if (ctx) removeMessage(qc, room, ctx.tempId)
      upsertMessage(qc, room, message)
    },
  })
}

export function useToggleLike(room: GroupRoomId | null) {
  const qc = useQueryClient()
  const me = useMyUserId()
  return useMutation({
    mutationFn: (id: string) => groupChat.toggleLike(id),
    onMutate: (id) => {
      const message = room ? findMessage(qc, room, id) : undefined
      if (!room || !me || !message) return undefined
      const liked = message.liked_by.includes(me)
      upsertMessage(qc, room, {
        ...message,
        liked_by: liked ? message.liked_by.filter((u) => u !== me) : [...message.liked_by, me],
      })
      return { message }
    },
    onError: (_e, _id, ctx) => {
      if (room && ctx) upsertMessage(qc, room, ctx.message)
    },
    onSuccess: (likedBy, id) => {
      const message = room ? findMessage(qc, room, id) : undefined
      if (room && message) upsertMessage(qc, room, { ...message, liked_by: likedBy })
    },
  })
}

export function useDeleteMessage(room: GroupRoomId | null) {
  const qc = useQueryClient()
  const me = useMyUserId()
  return useMutation({
    mutationFn: (id: string) => groupChat.deleteMessage(id),
    onMutate: (id) => {
      const message = room ? findMessage(qc, room, id) : undefined
      if (!room || !message) return undefined
      upsertMessage(qc, room, {
        ...message,
        body: '',
        liked_by: [],
        deleted_at: new Date().toISOString(),
        deleted_by: me,
      })
      return { message }
    },
    onError: (_e, _id, ctx) => {
      if (room && ctx) upsertMessage(qc, room, ctx.message)
    },
    onSettled: () => {
      if (room) void qc.invalidateQueries({ queryKey: groupKeys.reports(room) })
    },
  })
}

export function useReportMessage() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => groupChat.report(id, reason),
  })
}

export function useGroupReports(room: GroupRoomId | null, enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.reports(room ?? 'men-recovery'),
    queryFn: () => groupChat.reports(),
    enabled: Boolean(room) && enabled,
    refetchInterval: 60_000,
  })
}

export function useRemoveMember(room: GroupRoomId | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      groupChat.removeMember(userId, reason),
    onSettled: () => {
      if (!room) return
      void qc.invalidateQueries({ queryKey: groupKeys.members(room) })
      void qc.invalidateQueries({ queryKey: groupKeys.reports(room) })
    },
  })
}

export function useResolveReport(room: GroupRoomId | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => groupChat.resolveReport(id),
    onSettled: () => {
      if (room) void qc.invalidateQueries({ queryKey: groupKeys.reports(room) })
    },
  })
}

/** Unread count for the Group tab badge (0 when not in a group). */
export function useGroupBadge(): number {
  const room = useMyRoom()
  const status = useGroupStatus(room)
  const member = status.data?.member ?? null
  const blocks = useGroupBlocks(Boolean(member))
  const unread = useGroupUnread(room, member, blocks.data ?? [])
  return member ? (unread.data ?? 0) : 0
}

/** How often to check for messages while the live connection is down. */
export const CATCH_UP_MS = 15_000

/**
 * Keeps the group up to date while the app is open, with no refreshing: new
 * and changed messages arrive live, and the unread badge follows them.
 * Mounted once, app-wide.
 *
 * Phones pause apps in the background and can drop the live connection, so
 * whenever the app comes back (or the connection or network does), it
 * fetches anything missed. While the connection is down it checks every
 * 15 seconds.
 */
export function useGroupLive(room: GroupRoomId | null, active: boolean) {
  const qc = useQueryClient()
  const me = useMyUserId()
  useEffect(() => {
    if (!room || !active || !groupChat.live) return
    let live = false
    let stopped = false
    let fetching = false

    const noticed = (message: GroupMessage) => {
      if (message.kind === 'system') {
        void qc.invalidateQueries({ queryKey: groupKeys.members(room) })
        if (message.user_id === me) void qc.invalidateQueries({ queryKey: groupKeys.status(room) })
      }
      if (message.user_id !== me) void qc.invalidateQueries({ queryKey: groupKeys.unread(room) })
    }

    const catchUp = async () => {
      if (fetching || stopped) return
      const loaded = qc.getQueryData<Pages>(groupKeys.messages(room))
      // The thread isn't open yet; it loads fresh when it is.
      if (!loaded) return void qc.invalidateQueries({ queryKey: groupKeys.unread(room) })
      fetching = true
      try {
        const latest = await groupChat.messages(room, { limit: MESSAGE_PAGE })
        const data = qc.getQueryData<Pages>(groupKeys.messages(room))
        if (stopped || !data) return
        const merged = mergeLatest(data.pages, latest, MESSAGE_PAGE)
        if (!merged) {
          void qc.invalidateQueries({ queryKey: groupKeys.messages(room) })
          void qc.invalidateQueries({ queryKey: groupKeys.unread(room) })
          return
        }
        if (merged.pages !== data.pages)
          qc.setQueryData<Pages>(groupKeys.messages(room), { ...data, pages: merged.pages })
        merged.added.forEach(noticed)
      } catch {
        // Offline or the server is busy; the next check tries again.
      } finally {
        fetching = false
      }
    }

    const unsubscribe = groupChat.subscribe(
      room,
      (message) => {
        upsertMessage(qc, room, message)
        noticed(message)
      },
      (connected) => {
        live = connected
        // Also covers anything sent between loading the thread and connecting.
        if (connected) void catchUp()
      },
    )

    const comeBack = () => {
      if (document.visibilityState !== 'visible') return
      groupChat.wake()
      void catchUp()
    }
    document.addEventListener('visibilitychange', comeBack)
    window.addEventListener('pageshow', comeBack)
    window.addEventListener('online', comeBack)
    const timer = window.setInterval(() => {
      if (!live && document.visibilityState === 'visible') void catchUp()
    }, CATCH_UP_MS)

    return () => {
      stopped = true
      unsubscribe()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', comeBack)
      window.removeEventListener('pageshow', comeBack)
      window.removeEventListener('online', comeBack)
    }
  }, [room, active, me, qc])
}

// ---------------------------------------------------------------------------
// Leaders
// ---------------------------------------------------------------------------

/** Everyone who leads, as a set of user ids. */
export function useLeaders() {
  return useQuery({
    queryKey: groupKeys.leaders,
    queryFn: async () => new Set(await groupChat.leaders()),
    staleTime: 5 * 60_000,
  })
}

export function useIsLeader(): boolean {
  const me = useMyUserId()
  const leaders = useLeaders()
  return Boolean(me && leaders.data?.has(me))
}

/** Leaders page: everyone with an account. */
export function useLeaderPeople(enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.people,
    queryFn: () => groupChat.leaderPeople(),
    enabled,
    refetchInterval: 60_000,
  })
}

/** Waiting requests, for the badge on the Leaders menu item. */
export function useJoinRequestCount(): number {
  const isLeader = useIsLeader()
  const people = useLeaderPeople(isLeader)
  return isLeader ? (people.data ?? []).filter((p) => p.member_status === 'pending').length : 0
}

export function useReviewRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, approve }: { userId: string; approve: boolean }) =>
      groupChat.reviewRequest(userId, approve),
    onSettled: () => void qc.invalidateQueries({ queryKey: groupKeys.people }),
  })
}

export function useSetLeader() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, make }: { userId: string; make: boolean }) => groupChat.setLeader(userId, make),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.leaders })
    },
  })
}
