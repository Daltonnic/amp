import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMyUserId } from './groupQueries'
import { notifications } from './notifications'
import type { AppNotification, NotificationKind } from './types'

/** How many to show; older ones are a scroll away in no app that matters. */
export const NOTIFICATION_LIMIT = 100

export const notificationKeys = {
  list: (userId: string | null) => ['notifications', userId ?? ''] as const,
}

export function useNotifications() {
  const me = useMyUserId()
  return useQuery({
    queryKey: notificationKeys.list(me),
    queryFn: () => notifications.list(NOTIFICATION_LIMIT),
    enabled: Boolean(me),
    staleTime: 30_000,
    // A safety net for anything the live connection missed (only while the app is on screen).
    refetchInterval: 2 * 60_000,
  })
}

/** Unread count for the bell. */
export function useUnreadNotificationCount(): number {
  const list = useNotifications()
  return (list.data ?? []).filter((n) => !n.read_at).length
}

type ReadOptions = { ids?: string[]; kinds?: NotificationKind[] }
const matches = (n: AppNotification, o: ReadOptions) =>
  !n.read_at && (!o.ids || o.ids.includes(n.id)) && (!o.kinds || o.kinds.includes(n.kind))

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  const me = useMyUserId()
  const key = notificationKeys.list(me)
  return useMutation({
    mutationFn: (opts: ReadOptions) => notifications.markRead(opts),
    onMutate: (opts) => {
      const now = new Date().toISOString()
      qc.setQueryData<AppNotification[]>(key, (rows) =>
        rows?.map((n) => (matches(n, opts) ? { ...n, read_at: now } : n)),
      )
    },
    onError: () => void qc.invalidateQueries({ queryKey: key }),
  })
}

export function useRemoveNotification() {
  const qc = useQueryClient()
  const me = useMyUserId()
  const key = notificationKeys.list(me)
  return useMutation({
    mutationFn: (id: string) => notifications.remove(id),
    onMutate: (id) => {
      qc.setQueryData<AppNotification[]>(key, (rows) => rows?.filter((n) => n.id !== id))
    },
    onError: () => void qc.invalidateQueries({ queryKey: key }),
  })
}

/** Keeps the list (and the bell's count) current while the app is open. Mounted once, app-wide. */
export function useNotificationsLive() {
  const qc = useQueryClient()
  const me = useMyUserId()
  useEffect(() => {
    if (!me || !notifications.live) return
    const refresh = () => void qc.invalidateQueries({ queryKey: notificationKeys.list(me) })
    const unsubscribe = notifications.subscribe(me, refresh)
    // Phones can drop the live connection in the background; catch up on return.
    const comeBack = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', comeBack)
    window.addEventListener('online', comeBack)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', comeBack)
      window.removeEventListener('online', comeBack)
    }
  }, [me, qc])
}

/**
 * Seeing the thing a notification is about counts as reading it: the group
 * for replies, the Leaders page for requests, the calendar for meetings.
 */
export function useReadOnVisit(kinds: NotificationKind[], enabled = true) {
  const list = useNotifications()
  const { mutate } = useMarkNotificationsRead()
  const key = kinds.join(',')
  const pending = enabled && (list.data ?? []).some((n) => !n.read_at && kinds.includes(n.kind))
  useEffect(() => {
    if (pending) mutate({ kinds: key.split(',') as NotificationKind[] })
  }, [pending, key, mutate])
}
