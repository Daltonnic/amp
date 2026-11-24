import { addDays, format, isSameDay } from 'date-fns'

/** When a meeting is, said plainly ("Starts today at 7:00 PM"). */
export function meetingWhen(startsAt: string, now = new Date()): string {
  const start = new Date(startsAt)
  const time = format(start, 'h:mm a')
  const started = start <= now
  const day = isSameDay(start, now)
    ? `today at ${time}`
    : !started && isSameDay(start, addDays(now, 1))
      ? `tomorrow at ${time}`
      : format(start, "EEE, MMM d 'at' h:mm a")
  return `${started ? 'Started' : 'Starts'} ${day}`
}

/** "Just now", "5 minutes ago", "Yesterday", "Nov 3". */
export function timeAgo(at: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(at).getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? 'Yesterday' : `${days} days ago`
  return format(new Date(at), 'MMM d')
}
