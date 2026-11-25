import { LocalNotifications, Weekday } from '@capacitor/local-notifications'
import { isNative } from './native'
import { pushSupport } from './push'

/**
 * Daily check-in reminders. The original app only stored a "daily
 * reminders" preference; this actually delivers them.
 *
 * In the iPhone and Android apps, reminders are local notifications, so
 * they work offline. Everywhere else (the web app, including the Home Screen
 * app on iPhone) the server sends them as push notifications, only on days
 * you haven't checked in yet (supabase/migrations/*_checkin_reminders.sql).
 */

// Lock-screen text stays discreet: no mention of addiction or recovery.
export const REMINDER_MESSAGES = [
  'Pause and check your heart.',
  'Take a moment to breathe.',
  'You are not alone.',
  'How are you, really? Take a moment to check in.',
  'One day at a time. One step at a time.',
  'Pause and check your heart.',
  'Take a moment to breathe.',
] as const

const WEEKDAYS = [
  Weekday.Sunday,
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
]
const BASE_ID = 7100

export const remindersSupported = isNative

/**
 * How this device gets reminders: scheduled on the device (phone apps), as
 * push notifications (needs notifications turned on), not until AMP is on the
 * Home Screen (iPhone browser), or not at all (browsers without push).
 */
export type ReminderChannel = 'device' | 'push' | 'install' | 'none'

export function reminderChannel(): ReminderChannel {
  if (remindersSupported) return 'device'
  const support = pushSupport()
  return support === 'web' ? 'push' : support === 'ios-browser' ? 'install' : 'none'
}

export type ReminderResult = 'scheduled' | 'denied' | 'unsupported' | 'cleared'

function parseTime(time: string): { hour: number; minute: number } {
  const [h = '20', m = '0'] = time.split(':')
  return {
    hour: Math.min(23, Math.max(0, Number(h) || 0)),
    minute: Math.min(59, Math.max(0, Number(m) || 0)),
  }
}

export async function clearReminders(): Promise<void> {
  if (!isNative) return
  await LocalNotifications.cancel({ notifications: WEEKDAYS.map((_, i) => ({ id: BASE_ID + i })) })
}

/** Schedules (or reschedules) one reminder per weekday at `time` ("HH:MM"). */
export async function syncReminders(enabled: boolean, time: string): Promise<ReminderResult> {
  if (!isNative) return 'unsupported'
  await clearReminders()
  if (!enabled) return 'cleared'

  let permission = await LocalNotifications.checkPermissions()
  if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
    permission = await LocalNotifications.requestPermissions()
  }
  if (permission.display !== 'granted') return 'denied'

  const { hour, minute } = parseTime(time)
  await LocalNotifications.schedule({
    notifications: WEEKDAYS.map((weekday, i) => ({
      id: BASE_ID + i,
      title: 'AMP',
      body: REMINDER_MESSAGES[i] ?? REMINDER_MESSAGES[0],
      schedule: { on: { weekday, hour, minute }, allowWhileIdle: true },
      // A gentle daily nudge doesn't need to-the-minute precision (Android).
      isExactNotification: false,
      extra: { route: '/check-in' },
    })),
  })
  return 'scheduled'
}

/** Opens the check-in screen when a reminder is tapped. */
export async function onReminderTapped(navigate: (route: string) => void) {
  if (!isNative) return () => {}
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const route = (action.notification.extra as { route?: string } | undefined)?.route
    if (route?.startsWith('/')) navigate(route)
  })
  return () => void handle.remove()
}
