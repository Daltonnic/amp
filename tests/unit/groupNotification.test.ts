import { describe, expect, it } from 'vitest'
import {
  eventReminderNotification,
  groupNotification,
  startsIn,
  joinRequestNotification,
  welcomeNotification,
} from '../../supabase/functions/_shared/groupNotification'

const base = {
  messageId: 'm1',
  roomName: 'Men in Recovery',
  authorName: 'Mark T.',
  body: 'Rough night, but I called my accountability partner.',
  preview: false,
  replyToYou: false,
}

describe('group notification wording', () => {
  it('is discreet by default: no group, names or text on the lock screen', () => {
    const n = groupNotification(base)
    expect(n).toEqual({
      title: 'AMP',
      body: 'New message in your group',
      url: '/group',
      tag: 'amp-group',
      discreet: true,
      stack: '{n} new messages in your group',
    })
    expect(JSON.stringify(n)).not.toMatch(/Recovery|Mark|Rough/)
  })

  it('says when someone replied to you, still without details', () => {
    expect(groupNotification({ ...base, replyToYou: true }).body).toBe('Someone replied to you in your group')
  })

  it('shows the group, name and text when the person chose previews', () => {
    const n = groupNotification({ ...base, preview: true, replyToYou: true })
    expect(n.title).toBe('Men in Recovery')
    expect(n.body).toBe('Mark T. replied to you: Rough night, but I called my accountability partner.')
    expect(n.tag).toBe('amp-group-m1')
  })

  it('shortens long messages', () => {
    const n = groupNotification({ ...base, preview: true, body: 'word '.repeat(100) })
    expect(n.body.length).toBeLessThanOrEqual('Mark T.: '.length + 140)
    expect(n.body.endsWith('…')).toBe(true)
  })
})

describe('leader and welcome notifications', () => {
  it('tells leaders about a request without names unless they chose previews', () => {
    const quiet = joinRequestNotification({ name: 'Ben T.', roomName: 'Men in Recovery', preview: false })
    expect(quiet.body).toBe('Someone asked to join a group')
    expect(JSON.stringify(quiet)).not.toMatch(/Ben|Recovery/)
    expect(quiet.url).toBe('/leaders')
    const full = joinRequestNotification({ name: 'Ben T.', roomName: 'Men in Recovery', preview: true })
    expect(full.body).toBe('Ben T. asked to join Men in Recovery.')
  })

  it('welcomes an approved person, opening the group', () => {
    const quiet = welcomeNotification({ roomName: 'Women in Recovery', preview: false })
    expect(quiet.title).toBe('AMP')
    expect(JSON.stringify(quiet)).not.toMatch(/Women/)
    expect(quiet.url).toBe('/group')
  })
})

describe('meeting reminders', () => {
  it('says when the meeting starts', () => {
    expect(startsIn(0)).toBe('is starting now')
    expect(startsIn(15)).toBe('starts in 15 minutes')
    expect(startsIn(60)).toBe('starts in 1 hour')
    expect(startsIn(120)).toBe('starts in 2 hours')
    expect(startsIn(1440)).toBe('starts in 1 day')
    expect(startsIn(2880)).toBe('starts in 2 days')
    expect(startsIn(10080)).toBe('starts in 1 week')
  })

  it('keeps the meeting name off the lock screen unless previews are on', () => {
    const quiet = eventReminderNotification({
      eventId: 'e1',
      title: 'Betrayal Healing Circle',
      minutes: 60,
      preview: false,
    })
    expect(quiet).toMatchObject({ title: 'AMP', body: 'A meeting starts in 1 hour', url: '/calendar' })
    expect(JSON.stringify(quiet)).not.toMatch(/Betrayal/)
    const full = eventReminderNotification({
      eventId: 'e1',
      title: 'Tuesday Night Group',
      minutes: 1440,
      preview: true,
    })
    expect(full).toMatchObject({ title: 'Tuesday Night Group', body: 'Starts in 1 day' })
    expect(eventReminderNotification({ eventId: 'e1', title: 'X', minutes: 0, preview: true }).body).toBe(
      'Starting now',
    )
    // Tapping opens that date of the meeting.
    expect(
      eventReminderNotification({
        eventId: 'e1',
        title: 'X',
        minutes: 60,
        preview: false,
        startsAt: '2026-12-02T01:00:00+00:00',
      }).url,
    ).toBe(`/calendar?event=e1&at=${Date.UTC(2026, 11, 2, 1)}`)
  })
})
