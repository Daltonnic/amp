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
