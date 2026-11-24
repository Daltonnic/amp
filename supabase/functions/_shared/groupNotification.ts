/**
 * What a group-message notification says. By default it is discreet — no
 * group name, no names, no message text — because it can appear on a lock
 * screen. People can choose to see the text in Settings.
 */
export interface GroupNotificationInput {
  messageId: string
  roomName: string
  authorName: string
  body: string
  /** The recipient chose "Show message text" on this device. */
  preview: boolean
  /** The message replies to one of the recipient's own messages. */
  replyToYou: boolean
}

export interface GroupNotification {
  title: string
  body: string
  url: string
  /** Discreet notifications share one tag, so they stack into one ("3 new messages"). */
  tag: string
  discreet: boolean
  /** Wording when several stack under one tag; "{n}" is the count. */
  stack?: string
}

const MAX_BODY = 140

export function groupNotification(n: GroupNotificationInput): GroupNotification {
  if (!n.preview) {
    return {
      title: 'AMP',
      body: n.replyToYou ? 'Someone replied to you in your group' : 'New message in your group',
      url: '/group',
      tag: 'amp-group',
      discreet: true,
      stack: '{n} new messages in your group',
    }
  }
  const text = n.body.replace(/\s+/g, ' ').trim()
  const short = text.length > MAX_BODY ? `${text.slice(0, MAX_BODY - 1).trimEnd()}…` : text
  return {
    title: n.roomName,
    body: `${n.authorName}${n.replyToYou ? ' replied to you' : ''}: ${short}`,
    url: '/group',
    tag: `amp-group-${n.messageId}`,
    discreet: false,
  }
}

/** To leaders: someone asked to join a group. */
export function joinRequestNotification(n: {
  name: string
  roomName: string
  preview: boolean
}): GroupNotification {
  return n.preview
    ? {
        title: 'New request to join',
        body: `${n.name} asked to join ${n.roomName}.`,
        url: '/leaders',
        tag: 'amp-leaders',
        discreet: false,
        stack: '{n} people are waiting to join a group',
      }
    : {
        title: 'AMP',
        body: 'Someone asked to join a group',
        url: '/leaders',
        tag: 'amp-leaders',
        discreet: true,
        stack: '{n} people are waiting to join a group',
      }
}

/** To the person: a leader approved their request. */
export function welcomeNotification(n: { roomName: string; preview: boolean }): GroupNotification {
  return {
    title: n.preview ? n.roomName : 'AMP',
    body: n.preview
      ? 'A leader approved your request. Welcome to the group!'
      : 'You’re in! A leader welcomed you into your group.',
    url: '/group',
    tag: 'amp-welcome',
    discreet: !n.preview,
  }
}

/** "starts in 1 hour", "starts in 2 days", "is starting now". */
export function startsIn(minutes: number): string {
  if (minutes <= 0) return 'is starting now'
  if (minutes % 10080 === 0) return `starts in ${minutes / 10080} ${minutes === 10080 ? 'week' : 'weeks'}`
  if (minutes % 1440 === 0) return `starts in ${minutes / 1440} ${minutes === 1440 ? 'day' : 'days'}`
  if (minutes % 60 === 0) return `starts in ${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}`
  return `starts in ${minutes} minutes`
}

/** A meeting reminder. Discreet by default: the meeting's name can be revealing. */
export function eventReminderNotification(n: {
  eventId: string
  title: string
  minutes: number
  preview: boolean
}): GroupNotification {
  const when = startsIn(n.minutes)
  return n.preview
    ? {
        title: n.title,
        body: when === 'is starting now' ? 'Starting now' : `${when[0]!.toUpperCase()}${when.slice(1)}`,
        url: '/calendar',
        tag: `amp-event-${n.eventId}`,
        discreet: false,
      }
    : {
        title: 'AMP',
        body: `A meeting ${when}`,
        url: '/calendar',
        tag: `amp-event-${n.eventId}`,
        discreet: true,
      }
}
