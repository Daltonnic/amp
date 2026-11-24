import { afterEach, describe, expect, it } from 'vitest'
import type { AccountabilityContact, CheckIn } from '@/data/types'
import {
  channelFor,
  mailtoUrl,
  normalizePhone,
  reachOut,
  smsUrl,
  summarizeCheckIn,
  supportMessage,
} from '@/lib/support'

const checkIn = (over: Partial<CheckIn> = {}) =>
  ({ emotions: [], custom_emotion: '', intensity: null, temptation_level: null, ...over }) as CheckIn

const contact = (over: Partial<AccountabilityContact> = {}): AccountabilityContact => ({
  id: 'c1',
  user_id: 'u1',
  name: 'Dan Smith',
  email: '',
  phone: '',
  relationship: 'Pastor',
  created_at: '',
  ...over,
})

describe('summarizeCheckIn', () => {
  it('is empty without a check-in', () => {
    expect(summarizeCheckIn(null)).toBe('')
  })

  it('lists every feeling, including words typed in', () => {
    expect(
      summarizeCheckIn(
        checkIn({ emotions: ['Anxious', 'Lonely'], custom_emotion: 'Worn out', temptation_level: 7 }),
      ),
    ).toBe("Today I'm feeling anxious, lonely and worn out (temptation 7/10).")
  })

  it('leaves out a temptation of 0', () => {
    expect(summarizeCheckIn(checkIn({ emotions: ['Peaceful'], temptation_level: 0 }))).toBe(
      "Today I'm feeling peaceful.",
    )
  })

  it('handles a single feeling and intensity', () => {
    expect(summarizeCheckIn(checkIn({ emotions: ['Grieving'], intensity: 8 }))).toBe(
      "Today I'm feeling grieving (intensity 8/10).",
    )
  })
})

describe('supportMessage', () => {
  it('writes the "I need support" text in first person, using the first name', () => {
    const text = supportMessage('support', 'Dan Smith', checkIn({ emotions: ['Tempted'] }))
    expect(text).toBe(
      "Hi Dan, I need support right now. Today I'm feeling tempted. Could you pray for me, reach out, or just let me know you're there?",
    )
  })

  it('leaves out the check-in when there is none today', () => {
    expect(supportMessage('support', 'Ruth')).toBe(
      "Hi Ruth, I need support right now. Could you pray for me, reach out, or just let me know you're there?",
    )
  })

  it('writes a check-in request', () => {
    expect(supportMessage('check_in_request', 'Ruth')).toMatch(/^Hi Ruth, could you check in on me/)
  })
})

describe('links', () => {
  it('normalizes phone numbers', () => {
    expect(normalizePhone('(555) 010-0123')).toBe('5550100123')
    expect(normalizePhone(' +1 555 010 0123 ')).toBe('+15550100123')
  })

  it('uses &body= on Apple devices and ?body= elsewhere', () => {
    expect(smsUrl('555-0100', 'Hi & bye', true)).toBe('sms:5550100&body=Hi%20%26%20bye')
    expect(smsUrl('555-0100', 'Hi & bye', false)).toBe('sms:5550100?body=Hi%20%26%20bye')
  })

  it('encodes mailto links', () => {
    expect(mailtoUrl('a@b.com', 'I need support', 'Line 1\nLine 2')).toBe(
      'mailto:a%40b.com?subject=I%20need%20support&body=Line%201%0ALine%202',
    )
  })
})

describe('reachOut', () => {
  const opened: string[] = []
  const w = window as Window & { __ampOpenExternal?: (url: string) => void }
  w.__ampOpenExternal = (url) => opened.push(url)
  afterEach(() => opened.splice(0))

  it('prefers texting when there is a mobile number', () => {
    expect(channelFor(contact({ phone: '555-0100', email: 'dan@example.com' }))).toBe('text')
    expect(reachOut(contact({ phone: '555-0100', email: 'dan@example.com' }), 'support')).toBe('text')
    expect(opened[0]).toMatch(/^sms:5550100[?&]body=Hi%20Dan%2C%20I%20need%20support/)
  })

  it('falls back to email, then to nothing', () => {
    expect(reachOut(contact({ email: 'dan@example.com' }), 'check_in_request')).toBe('email')
    expect(opened[0]).toMatch(/^mailto:dan%40example\.com\?subject=Could%20you%20check%20in%20on%20me/)
    expect(reachOut(contact(), 'support')).toBeNull()
    expect(opened).toHaveLength(1)
  })
})
