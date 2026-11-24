import { PushNotifications } from '@capacitor/push-notifications'
import { config, isCloudConfigured } from './config'
import { isNative, isStandalonePwa, platform } from './native'
import { getSupabase } from './supabase'

/**
 * Push notifications for this device — delivered by the phone or computer
 * itself, so they arrive even when AMP is closed.
 *
 * - Browsers and Home Screen web apps: Web Push through the service worker
 *   (public/push-sw.js). On iPhone/iPad this needs AMP added to the Home Screen.
 * - Store apps: Apple/Google push through @capacitor/push-notifications
 *   (only when config.nativePush is on).
 *
 * The server keeps one row per device (public.push_subscriptions); the
 * notify-group function sends to them when someone posts in the group.
 */

export type PushSupport =
  /** Can be turned on here. */
  | 'web'
  | 'native'
  /** iPhone/iPad in Safari: add AMP to the Home Screen first. */
  | 'ios-browser'
  /** This browser can't do push, or this build has no server. */
  | 'unsupported'

export type PushState = 'on' | 'off' | 'blocked'

interface TestHook {
  permission: NotificationPermission
  subscribed: boolean
  preview: boolean
}
declare global {
  interface Window {
    /** End-to-end tests replace the browser push service with this. */
    __ampFakePush?: TestHook
  }
}
const fake = () => (typeof window !== 'undefined' ? window.__ampFakePush : undefined)

const MARKER = 'amp.push.device'

/** "userId|endpoint" of the subscription this device registered, if any. */
function marker(): { userId: string; endpoint: string } | null {
  try {
    const raw = localStorage.getItem(MARKER)
    if (!raw) return null
    const [userId, ...rest] = raw.split('|')
    return userId && rest.length ? { userId, endpoint: rest.join('|') } : null
  } catch {
    return null
  }
}
function setMarker(userId: string, endpoint: string) {
  try {
    localStorage.setItem(MARKER, `${userId}|${endpoint}`)
  } catch {
    /* private mode */
  }
}
function clearMarker() {
  try {
    localStorage.removeItem(MARKER)
  } catch {
    /* private mode */
  }
}

const isAppleMobile = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function pushSupport(): PushSupport {
  if (fake()) return 'web'
  if (!isCloudConfigured) return 'unsupported'
  if (isNative) return config.nativePush ? 'native' : 'unsupported'
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isAppleMobile() && !isStandalonePwa()) return 'ios-browser'
  return hasApi ? 'web' : 'unsupported'
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Please sign in again.')
  return id
}

async function serviceWorker(): Promise<ServiceWorkerRegistration> {
  const ready = navigator.serviceWorker.ready
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Notifications need the installed app. Reload AMP and try again.')),
      10_000,
    ),
  )
  return Promise.race([ready, timeout])
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function register(row: {
  platform: 'web' | 'ios' | 'android'
  endpoint: string
  p256dh?: string
  auth?: string
  showPreview: boolean
}) {
  const { error } = await getSupabase().rpc('push_register', {
    platform: row.platform,
    endpoint: row.endpoint,
    p256dh: row.p256dh ?? null,
    auth: row.auth ?? null,
    show_preview: row.showPreview,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export async function pushState(userId: string | null): Promise<PushState> {
  const f = fake()
  if (f) return f.permission === 'denied' ? 'blocked' : f.subscribed ? 'on' : 'off'
  const support = pushSupport()
  if (support === 'web') {
    if (Notification.permission === 'denied') return 'blocked'
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    const m = marker()
    return sub && Notification.permission === 'granted' && m?.userId === userId && m.endpoint === sub.endpoint
      ? 'on'
      : 'off'
  }
  if (support === 'native') {
    const { receive } = await PushNotifications.checkPermissions()
    if (receive === 'denied') return 'blocked'
    const m = marker()
    return receive === 'granted' && m?.userId === userId ? 'on' : 'off'
  }
  return 'off'
}

/** Whether this device shows message text in notifications. */
export async function previewEnabled(): Promise<boolean> {
  const f = fake()
  if (f) return f.preview
  const m = marker()
  if (!m || !isCloudConfigured) return false
  const { data } = await getSupabase()
    .from('push_subscriptions')
    .select('show_preview')
    .eq('endpoint', m.endpoint)
    .maybeSingle()
  return Boolean((data as { show_preview?: boolean } | null)?.show_preview)
}

// ---------------------------------------------------------------------------
// Turning it on and off
// ---------------------------------------------------------------------------

function nativeToken(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The phone didn’t respond. Please try again.')), 20_000)
    void PushNotifications.addListener('registration', (t) => {
      clearTimeout(timer)
      resolve(t.value)
    })
    void PushNotifications.addListener('registrationError', (e) => {
      clearTimeout(timer)
      reject(new Error(e.error || 'Couldn’t turn on notifications.'))
    })
    void PushNotifications.register()
  }).finally(() => void PushNotifications.removeAllListeners().then(() => listenForTaps()))
}

/** Asks for permission (if needed) and turns on notifications for this device. */
/**
 * Starts the browser's "Allow notifications?" prompt. Call it directly in the
 * tap handler, before anything async: iPhone Home Screen apps only show the
 * prompt during the tap itself. Pass the result to enablePush().
 */
export function requestPushPermission(): Promise<NotificationPermission> | undefined {
  if (fake() || pushSupport() !== 'web') return undefined
  return Notification.requestPermission()
}

export async function enablePush(
  showPreview = false,
  permissionRequest?: Promise<NotificationPermission>,
): Promise<PushState> {
  const f = fake()
  if (f) {
    if (f.permission === 'default') f.permission = 'granted'
    if (f.permission !== 'granted') return 'blocked'
    f.subscribed = true
    f.preview = showPreview
    return 'on'
  }
  const userId = await currentUserId()
  const support = pushSupport()

  if (support === 'web') {
    const permission = await (permissionRequest ?? Notification.requestPermission())
    if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
    const reg = await serviceWorker()
    const options = { userVisibleOnly: true, applicationServerKey: keyBytes(config.vapidPublicKey) }
    let sub = await reg.pushManager.getSubscription()
    // A subscription made with an older server key has to be replaced.
    const currentKey = sub?.options.applicationServerKey
    if (
      sub &&
      currentKey &&
      new Uint8Array(currentKey).toString() !== options.applicationServerKey.toString()
    ) {
      await sub.unsubscribe()
      sub = null
    }
    sub ??= await reg.pushManager.subscribe(options)
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
      throw new Error('This browser returned an incomplete subscription.')
    await register({
      platform: 'web',
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      showPreview,
    })
    setMarker(userId, json.endpoint)
    return 'on'
  }

  if (support === 'native') {
    let { receive } = await PushNotifications.checkPermissions()
    if (receive === 'prompt' || receive === 'prompt-with-rationale')
      receive = (await PushNotifications.requestPermissions()).receive
    if (receive !== 'granted') return 'blocked'
    if (platform === 'android') {
      await PushNotifications.createChannel({
        id: 'group',
        name: 'Group messages',
        description: 'New messages in your group',
        importance: 4,
        visibility: 0, // Private: hides details on a secure lock screen.
      })
    }
    const token = await nativeToken()
    await register({ platform: platform === 'ios' ? 'ios' : 'android', endpoint: token, showPreview })
    setMarker(userId, token)
    return 'on'
  }

  throw new Error('Notifications aren’t available here.')
}

/** Turns off notifications for this device (other devices are unaffected). */
export async function disablePush(): Promise<void> {
  const f = fake()
  if (f) {
    f.subscribed = false
    return
  }
  const m = marker()
  if (m && isCloudConfigured) {
    await getSupabase().rpc('push_unregister', { endpoint: m.endpoint })
  }
  clearMarker()
  if (pushSupport() === 'web') {
    const reg = await navigator.serviceWorker.getRegistration()
    await (await reg?.pushManager.getSubscription())?.unsubscribe()
  } else if (pushSupport() === 'native') {
    await PushNotifications.unregister().catch(() => {})
  }
}

export async function setPreview(show: boolean): Promise<void> {
  const f = fake()
  if (f) {
    f.preview = show
    return
  }
  // Re-registering updates the setting on this device's row.
  await enablePush(show)
}

/**
 * Keeps the server in step with this device: browsers sometimes replace a
 * subscription, and a device that was turned off elsewhere should say so.
 * Runs when the app starts.
 */
export async function syncPush(userId: string): Promise<void> {
  if (fake() || pushSupport() !== 'web') return
  const m = marker()
  if (!m || m.userId !== userId || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) {
    await getSupabase().rpc('push_unregister', { endpoint: m.endpoint })
    clearMarker()
    return
  }
  const json = sub.toJSON()
  if (json.endpoint !== m.endpoint && json.endpoint && json.keys?.p256dh && json.keys.auth) {
    const showPreview = await previewEnabled()
    await getSupabase().rpc('push_unregister', { endpoint: m.endpoint })
    await register({
      platform: 'web',
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      showPreview,
    })
    setMarker(userId, json.endpoint)
  }
}

/** Called before signing out, so this device stops getting that account's notifications. */
export async function forgetDeviceOnSignOut(): Promise<void> {
  if (!marker()) return
  await disablePush().catch(() => clearMarker())
}

/** Clears group notifications and the app-icon badge (when the group is open). */
export async function clearGroupNotifications(): Promise<void> {
  try {
    if (isNative) {
      if (config.nativePush) await PushNotifications.removeAllDeliveredNotifications()
      return
    }
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
    await nav.clearAppBadge?.()
    const reg = await navigator.serviceWorker?.getRegistration()
    const shown = (await reg?.getNotifications()) ?? []
    for (const n of shown) if (n.tag.startsWith('amp-group')) n.close()
  } catch {
    /* not supported here */
  }
}

let onTap: ((url: string) => void) | null = null

function listenForTaps() {
  if (!isNative || !config.nativePush) return
  void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification.data as { url?: string } | undefined)?.url ?? '/group'
    onTap?.(url)
  })
}

/** Opens the right screen when a notification is tapped. Returns a cleanup function. */
export function handleNotificationTaps(navigate: (url: string) => void): () => void {
  onTap = navigate
  listenForTaps()
  const onMessage = (e: MessageEvent) => {
    const data = e.data as { type?: string; url?: string } | null
    if (data?.type === 'amp-open' && typeof data.url === 'string' && data.url.startsWith('/'))
      navigate(data.url)
  }
  if (!isNative && 'serviceWorker' in navigator)
    navigator.serviceWorker.addEventListener('message', onMessage)
  return () => {
    onTap = null
    if (isNative && config.nativePush) void PushNotifications.removeAllListeners()
    if (!isNative && 'serviceWorker' in navigator)
      navigator.serviceWorker.removeEventListener('message', onMessage)
  }
}
