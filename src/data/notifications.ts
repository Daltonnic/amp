import type { SupabaseClient } from '@supabase/supabase-js'
import { isCloudConfigured } from '@/lib/config'
import { getSupabase } from '@/lib/supabase'
import type { AppNotification, NotificationKind } from './types'

/**
 * Your notifications. The database writes them as things happen (replies,
 * join requests and approvals, becoming a leader, meeting reminders), whether
 * or not push notifications are on. You can only see and remove your own.
 */
export interface NotificationsApi {
  /** True when changes arrive live (the cloud backend). */
  readonly live: boolean
  /** Newest first. */
  list(limit: number): Promise<AppNotification[]>
  /** Marks all of them read, or only the given ones or kinds. */
  markRead(opts?: { ids?: string[]; kinds?: NotificationKind[] }): Promise<void>
  remove(id: string): Promise<void>
  /** Calls `onChange` when a notification arrives or changes, and when the live connection (re)connects. */
  subscribe(userId: string, onChange: () => void): () => void
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export function createSupabaseNotifications(sb: SupabaseClient): NotificationsApi {
  return {
    live: true,
    async list(limit) {
      const { data, error } = await sb
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      fail(error)
      return data as AppNotification[]
    },
    async markRead(opts = {}) {
      const { error } = await sb.rpc('notifications_mark_read', {
        ids: opts.ids ?? null,
        kinds: opts.kinds ?? null,
      })
      fail(error)
    },
    async remove(id) {
      const { error } = await sb.from('notifications').delete().eq('id', id)
      fail(error)
    },
    subscribe(userId, onChange) {
      const filter = `user_id=eq.${userId}`
      const channel = sb
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter },
          onChange,
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter },
          onChange,
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') onChange()
        })
      return () => void sb.removeChannel(channel)
    },
  }
}

// On-device (development, previews and automated tests): nothing writes
// notifications here, but tests can seed them.
export const DEVICE_NOTIFICATIONS_KEY = 'amp.device.notifications'

function load(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_NOTIFICATIONS_KEY) ?? '[]') as AppNotification[]
  } catch {
    return []
  }
}
const save = (rows: AppNotification[]) => localStorage.setItem(DEVICE_NOTIFICATIONS_KEY, JSON.stringify(rows))

export function createDeviceNotifications(): NotificationsApi {
  return {
    live: false,
    async list(limit) {
      return load()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit)
    },
    async markRead(opts = {}) {
      const now = new Date().toISOString()
      save(
        load().map((n) =>
          !n.read_at && (!opts.ids || opts.ids.includes(n.id)) && (!opts.kinds || opts.kinds.includes(n.kind))
            ? { ...n, read_at: now }
            : n,
        ),
      )
    },
    async remove(id) {
      save(load().filter((n) => n.id !== id))
    },
    subscribe() {
      return () => {}
    },
  }
}

export const notifications: NotificationsApi = isCloudConfigured
  ? createSupabaseNotifications(getSupabase())
  : createDeviceNotifications()
