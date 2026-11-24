import type { SupabaseClient } from '@supabase/supabase-js'
import { roomFor } from '@/content/group'
import { isCloudConfigured } from '@/lib/config'
import { publicName } from '@/lib/names'
import { getSupabase } from '@/lib/supabase'
import { DEVICE_USER_ID } from './deviceBackend'
import { RateLimitedError } from './backend'
import type { GroupMember, GroupMessage, GroupReport, GroupRoomId, LeaderPerson, Profile } from './types'

/**
 * Group chat. Every change goes through a database function
 * (supabase/migrations/*_group_chat.sql), which enforces who may do what;
 * reads are limited to the person's own group by Row Level Security.
 */

export interface GroupStatus {
  /** The person's membership in the group their profile belongs in, if active. */
  member: GroupMember | null
  /** A leader removed them from that group. */
  removed: boolean
  /** They asked to join and are waiting for a leader. */
  pending: boolean
  /** A leader declined their request (they can ask again). */
  declined: boolean
}

export interface GroupChatApi {
  /** False on-device, where there is nobody else to hear from. */
  readonly live: boolean
  status(room: GroupRoomId): Promise<GroupStatus>
  join(): Promise<GroupMember>
  leave(): Promise<void>
  members(room: GroupRoomId): Promise<GroupMember[]>
  /** Newest first. `before` pages back through older messages. */
  messages(room: GroupRoomId, opts: { before?: string; limit: number }): Promise<GroupMessage[]>
  message(id: string): Promise<GroupMessage | null>
  send(body: string, replyTo: string | null): Promise<GroupMessage>
  toggleLike(id: string): Promise<string[]>
  deleteMessage(id: string): Promise<void>
  markRead(): Promise<void>
  /** Messages from others since `since`, not counting `exclude` (you and anyone you blocked). */
  unreadCount(room: GroupRoomId, since: string, exclude: string[]): Promise<number>
  report(id: string, reason: string): Promise<void>
  blocks(): Promise<string[]>
  block(userId: string): Promise<void>
  unblock(userId: string): Promise<void>
  /** Moderators: open reports in their group. */
  reports(): Promise<GroupReport[]>
  removeMember(userId: string, reason: string): Promise<void>
  resolveReport(id: string): Promise<void>
  /** User ids of every leader (shown in gold). */
  leaders(): Promise<string[]>
  /** Leaders: everyone with an account, with their group status. */
  leaderPeople(): Promise<LeaderPerson[]>
  /** Leaders: approve or decline a request to join a group. */
  reviewRequest(userId: string, approve: boolean): Promise<void>
  /** Leaders: make someone a leader, or step them down. */
  setLeader(userId: string, make: boolean): Promise<void>
  /**
   * Live updates: `onMessage` gets each new or changed message, `onReconnect`
   * fires when the connection comes back (so missed messages can be fetched).
   */
  subscribe(room: GroupRoomId, onMessage: (m: GroupMessage) => void, onReconnect: () => void): () => void
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function fail(error: { message: string; code?: string } | null): void {
  if (!error) return
  if (error.code === '53400') throw new RateLimitedError(error.message)
  throw new Error(error.message)
}

export function createSupabaseGroupChat(sb: SupabaseClient): GroupChatApi {
  const rpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args)
    fail(error)
    return data as T
  }
  const myId = async () => {
    const { data } = await sb.auth.getSession()
    return data.session?.user.id ?? null
  }

  return {
    live: true,

    async status(room) {
      const uid = await myId()
      if (!uid) return { member: null, removed: false, pending: false, declined: false }
      const [member, ban] = await Promise.all([
        sb.from('chat_members').select('*').eq('user_id', uid).maybeSingle(),
        sb.from('chat_bans').select('room').eq('user_id', uid).eq('room', room).maybeSingle(),
      ])
      fail(member.error)
      fail(ban.error)
      const row = member.data as GroupMember | null
      const removed = Boolean(ban.data)
      const here = row && row.room === room && !removed ? row : null
      return {
        member: here && here.status === 'active' && !here.left_at ? here : null,
        removed,
        pending: here?.status === 'pending',
        declined: here?.status === 'declined',
      }
    },

    join: () => rpc<GroupMember>('chat_join'),
    leave: () => rpc<void>('chat_leave'),

    async members(room) {
      const { data, error } = await sb.from('chat_members').select('*').eq('room', room)
      fail(error)
      return data as GroupMember[]
    },

    async messages(room, { before, limit }) {
      let q = sb.from('chat_messages').select('*').eq('room', room)
      if (before) q = q.lt('created_at', before)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
      fail(error)
      return data as GroupMessage[]
    },

    async message(id) {
      const { data, error } = await sb.from('chat_messages').select('*').eq('id', id).maybeSingle()
      fail(error)
      return data as GroupMessage | null
    },

    send: (body, replyTo) => rpc<GroupMessage>('chat_send', { body, reply_to: replyTo }),
    toggleLike: (id) => rpc<string[]>('chat_toggle_like', { message_id: id }),
    deleteMessage: (id) => rpc<void>('chat_delete_message', { message_id: id }),
    markRead: () => rpc<void>('chat_mark_read'),

    async unreadCount(room, since, exclude) {
      let q = sb
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('room', room)
        .eq('kind', 'text')
        .is('deleted_at', null)
        .gt('created_at', since)
      if (exclude.length) q = q.not('user_id', 'in', `(${exclude.join(',')})`)
      const { count, error } = await q
      fail(error)
      return count ?? 0
    },

    report: (id, reason) => rpc<void>('chat_report', { message_id: id, reason }),

    async blocks() {
      const { data, error } = await sb.from('chat_blocks').select('blocked')
      fail(error)
      return (data as { blocked: string }[]).map((r) => r.blocked)
    },
    async block(userId) {
      const { error } = await sb.from('chat_blocks').insert({ blocked: userId })
      if (error && error.code !== '23505') fail(error)
    },
    async unblock(userId) {
      const { error } = await sb.from('chat_blocks').delete().eq('blocked', userId)
      fail(error)
    },

    async reports() {
      const { data, error } = await sb
        .from('chat_reports')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
      fail(error)
      return data as GroupReport[]
    },
    removeMember: (userId, reason) => rpc<void>('chat_remove_member', { member_id: userId, reason }),
    resolveReport: (id) => rpc<void>('chat_resolve_report', { report_id: id }),

    async leaders() {
      const { data, error } = await sb.from('leaders').select('user_id')
      fail(error)
      return (data as { user_id: string }[]).map((r) => r.user_id)
    },
    leaderPeople: () => rpc<LeaderPerson[]>('leader_people'),
    reviewRequest: (userId, approve) => rpc<void>('leader_review_request', { member_id: userId, approve }),
    setLeader: (userId, make) => rpc<void>('leader_set_leader', { member_id: userId, make }),

    subscribe(room, onMessage, onReconnect) {
      let subscribedOnce = false
      const handler = (payload: { new: unknown }) => onMessage(payload.new as GroupMessage)
      const filter = `room=eq.${room}`
      const channel = sb
        .channel(`group:${room}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter },
          handler,
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter },
          handler,
        )
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') return
          if (subscribedOnce) onReconnect()
          subscribedOnce = true
        })
      return () => void sb.removeChannel(channel)
    },
  }
}

// ---------------------------------------------------------------------------
// On-device (development, previews and automated tests)
// ---------------------------------------------------------------------------

const KEY = {
  members: 'amp.device.group_members',
  /** On-device the one person here leads, unless a test says otherwise. */
  leaders: 'amp.device.leaders',
  messages: 'amp.device.group_messages',
  blocks: 'amp.device.group_blocks',
  reports: 'amp.device.group_reports',
}

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}
const save = (key: string, rows: unknown[]) => localStorage.setItem(key, JSON.stringify(rows))

function deviceProfile(): Profile | null {
  return load<Profile>('amp.device.profiles').find((p) => p.user_id === DEVICE_USER_ID) ?? null
}

export function createDeviceGroupChat(): GroupChatApi {
  const me = DEVICE_USER_ID
  const now = () => new Date().toISOString()
  const myMember = () => {
    const m = load<GroupMember>(KEY.members).find((x) => x.user_id === me)
    // Rows saved before join approvals existed count as active.
    return m ? { ...m, status: m.status ?? 'active', requested_at: m.requested_at ?? null } : null
  }
  const leaderIds = (): string[] =>
    localStorage.getItem(KEY.leaders) === null ? [me] : load<string>(KEY.leaders)
  const isLeader = () => leaderIds().includes(me)
  const activeRoom = (): GroupRoomId => {
    const p = deviceProfile()
    const room = p && roomFor(p.track, p.gender)
    const m = myMember()
    if (!room || !m || m.left_at || m.room !== room) throw new Error("You're not in a group right now.")
    return room
  }
  const updateMessage = (id: string, change: (m: GroupMessage) => GroupMessage) => {
    const rows = load<GroupMessage>(KEY.messages)
    const i = rows.findIndex((m) => m.id === id)
    if (i < 0) throw new Error("That message isn't available.")
    rows[i] = change(rows[i]!)
    save(KEY.messages, rows)
    return rows[i]!
  }
  const addSystem = (room: GroupRoomId, body: string) =>
    save(KEY.messages, [
      ...load<GroupMessage>(KEY.messages),
      {
        id: crypto.randomUUID(),
        room,
        user_id: me,
        kind: 'system',
        body,
        reply_to: null,
        liked_by: [],
        created_at: now(),
        deleted_at: null,
        deleted_by: null,
      } satisfies GroupMessage,
    ])

  return {
    live: false,

    async status(room) {
      const m = myMember()
      const here = m && m.room === room ? m : null
      return {
        member:
          here && here.status !== 'pending' && here.status !== 'declined' && !here.left_at ? here : null,
        removed: false,
        pending: here?.status === 'pending',
        declined: here?.status === 'declined',
      }
    },

    async join() {
      const p = deviceProfile()
      if (!p) throw new Error('Finish setting up your profile first.')
      const room = roomFor(p.track, p.gender)
      if (!room) throw new Error("Tell us whether you're a man or a woman in Settings to join your group.")
      const name = publicName({
        first: p.display_name,
        last: p.last_name ?? '',
        style: p.name_display ?? 'first_last_initial',
        nickname: p.nickname ?? '',
      })
      if (!name) throw new Error('Add the name you want the group to see first.')
      const prior = myMember()
      const admit =
        isLeader() || (prior?.room === room && prior.status !== 'pending' && prior.status !== 'declined')
      const member: GroupMember = {
        user_id: me,
        room,
        display_name: name,
        role: 'member',
        status: admit ? 'active' : 'pending',
        requested_at: admit ? null : now(),
        joined_at: prior && !prior.left_at && prior.room === room ? prior.joined_at : now(),
        agreed_at: now(),
        last_read_at: now(),
        left_at: null,
      }
      save(KEY.members, [...load<GroupMember>(KEY.members).filter((m) => m.user_id !== me), member])
      if (admit && (!prior || prior.left_at || prior.room !== room || prior.status !== 'active')) {
        addSystem(room, 'joined the group')
      }
      return member
    },

    async leave() {
      const m = myMember()
      if (!m || m.left_at) return
      save(
        KEY.members,
        load<GroupMember>(KEY.members).map((x) => (x.user_id === me ? { ...x, left_at: now() } : x)),
      )
      addSystem(m.room, 'left the group')
    },

    async members(room) {
      return load<GroupMember>(KEY.members).filter((m) => m.room === room)
    },

    async messages(room, { before, limit }) {
      return load<GroupMessage>(KEY.messages)
        .filter((m) => m.room === room && (!before || m.created_at < before))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit)
    },

    async message(id) {
      return load<GroupMessage>(KEY.messages).find((m) => m.id === id) ?? null
    },

    async send(body, replyTo) {
      const room = activeRoom()
      const text = body.trim()
      if (!text) throw new Error('Write a message first.')
      if (text.length > 2000) throw new Error('Messages can be up to 2,000 characters.')
      const message: GroupMessage = {
        id: crypto.randomUUID(),
        room,
        user_id: me,
        kind: 'text',
        body: text,
        reply_to: replyTo,
        liked_by: [],
        created_at: now(),
        deleted_at: null,
        deleted_by: null,
      }
      save(KEY.messages, [...load<GroupMessage>(KEY.messages), message])
      return message
    },

    async toggleLike(id) {
      activeRoom()
      return updateMessage(id, (m) => ({
        ...m,
        liked_by: m.liked_by.includes(me) ? m.liked_by.filter((u) => u !== me) : [...m.liked_by, me],
      })).liked_by
    },

    async deleteMessage(id) {
      activeRoom()
      updateMessage(id, (m) => {
        if (m.user_id !== me) throw new Error('You can only delete your own messages.')
        return { ...m, body: '', liked_by: [], deleted_at: now(), deleted_by: me }
      })
    },

    async markRead() {
      save(
        KEY.members,
        load<GroupMember>(KEY.members).map((m) => (m.user_id === me ? { ...m, last_read_at: now() } : m)),
      )
    },

    async unreadCount(room, since, exclude) {
      return load<GroupMessage>(KEY.messages).filter(
        (m) =>
          m.room === room &&
          m.kind === 'text' &&
          !m.deleted_at &&
          m.created_at > since &&
          !exclude.includes(m.user_id),
      ).length
    },

    async report(id, reason) {
      save(KEY.reports, [...load<{ id: string; reason: string }>(KEY.reports), { id, reason }])
    },

    async blocks() {
      return load<string>(KEY.blocks)
    },
    async block(userId) {
      save(KEY.blocks, [...new Set([...load<string>(KEY.blocks), userId])])
    },
    async unblock(userId) {
      save(
        KEY.blocks,
        load<string>(KEY.blocks).filter((u) => u !== userId),
      )
    },

    async reports() {
      return []
    },

    async leaders() {
      return leaderIds()
    },
    async leaderPeople() {
      const p = deviceProfile()
      const m = myMember()
      const room = p ? roomFor(p.track, p.gender) : null
      return [
        {
          user_id: me,
          email: '',
          first_name: p?.display_name ?? '',
          last_name: p?.last_name ?? '',
          shown_name: m?.display_name ?? '',
          gender: p?.gender ?? null,
          track: p?.track ?? null,
          room,
          member_status:
            !m || m.room !== room
              ? 'none'
              : m.status === 'active'
                ? m.left_at
                  ? 'left'
                  : 'member'
                : m.status,
          requested_at: m?.requested_at ?? null,
          joined_at: m?.joined_at ?? null,
          is_leader: isLeader(),
          created_at: p?.created_at ?? now(),
        },
      ]
    },
    async reviewRequest() {
      throw new Error('There’s nobody else on this device to approve.')
    },
    async setLeader(userId, make) {
      if (!make && leaderIds().length <= 1) throw new Error('There must always be at least one leader.')
      save(
        KEY.leaders,
        make ? [...new Set([...leaderIds(), userId])] : leaderIds().filter((u) => u !== userId),
      )
    },
    async removeMember() {
      throw new Error('Only moderators can remove people.')
    },
    async resolveReport() {
      throw new Error('Only moderators can review reports.')
    },

    subscribe() {
      return () => {}
    },
  }
}

export const groupChat: GroupChatApi = isCloudConfigured
  ? createSupabaseGroupChat(getSupabase())
  : createDeviceGroupChat()
