import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Runs the real public/push-sw.js against a stand-in service worker, to
 * check what each push looks like on the phone.
 */
type Shown = { title: string; body: string; tag: string; data: { url: string; count: number } }
const source = readFileSync(join(process.cwd(), 'public/push-sw.js'), 'utf8')

let shown: Shown[]
let push: (payload: object) => Promise<void>

beforeEach(() => {
  shown = []
  const handlers: Record<string, (event: unknown) => void> = {}
  const sw = {
    addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn),
    location: { origin: 'https://amp.example' },
    navigator: {},
    clients: { matchAll: async () => [], openWindow: async () => null },
    registration: {
      // Like the phone: one notification per tag; a new one replaces it.
      getNotifications: async (filter?: { tag?: string }) =>
        shown.filter((n) => !filter?.tag || n.tag === filter.tag),
      showNotification: async (title: string, options: Omit<Shown, 'title'>) => {
        shown = [...shown.filter((n) => n.tag !== options.tag), { title, ...options }]
      },
    },
  }
  new Function('self', source)(sw)
  push = async (payload) => {
    let done: Promise<unknown> = Promise.resolve()
    handlers.push!({ data: { json: () => payload }, waitUntil: (p: Promise<unknown>) => (done = p) })
    await done
  }
})

const checkin = (body: string) => ({
  title: 'AMP',
  body,
  url: '/check-in',
  tag: 'amp-checkin',
  discreet: true,
})
const groupMessage = {
  title: 'AMP',
  body: 'New message in your group',
  url: '/group',
  tag: 'amp-group',
  discreet: true,
  stack: '{n} new messages in your group',
}

describe('push notifications on the phone', () => {
  it('shows a check-in reminder as a reminder, even when yesterday’s is still there', async () => {
    await push(checkin('Pause and check your heart.'))
    await push(checkin('You are not alone.'))
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatchObject({ title: 'AMP', body: 'You are not alone.', data: { url: '/check-in' } })
  })

  it('keeps a second reminder for the same meeting about the meeting', async () => {
    const meeting = { title: 'AMP', url: '/calendar', tag: 'amp-event-1', discreet: true }
    await push({ ...meeting, body: 'A meeting starts in 1 day' })
    await push({ ...meeting, body: 'A meeting starts in 1 hour' })
    expect(shown.map((n) => n.body)).toEqual(['A meeting starts in 1 hour'])
  })

  it('still stacks group messages into a count, separately from reminders', async () => {
    await push(checkin('Take a moment to breathe.'))
    await push(groupMessage)
    await push(groupMessage)
    await push(groupMessage)
    expect(shown.find((n) => n.tag === 'amp-group')?.body).toBe('3 new messages in your group')
    expect(shown.find((n) => n.tag === 'amp-checkin')?.body).toBe('Take a moment to breathe.')
  })
})
