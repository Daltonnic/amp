import { describe, expect, it } from 'vitest'
import { composeEmail, summarizeCheckIn, toHtml } from '../../supabase/functions/_shared/emails'

describe('summarizeCheckIn', () => {
  it('is first person when there is no check-in today', () => {
    expect(summarizeCheckIn(null)).toBe("I haven't completed today's check-in yet.")
  })

  it('describes feeling, intensity and temptation', () => {
    expect(summarizeCheckIn({ emotional_state: 'Anxious', intensity: 7, temptation_level: 6 })).toBe(
      'Today\'s check-in: feeling "Anxious" (intensity 7/10), temptation level 6/10.',
    )
  })

  it('falls back to the custom emotion', () => {
    expect(
      summarizeCheckIn({
        emotional_state: '',
        custom_emotion: 'Worn out',
        intensity: null,
        temptation_level: null,
      }),
    ).toBe('Today\'s check-in: feeling "Worn out".')
  })
})

describe('composeEmail', () => {
  it('builds the "I need support" email', () => {
    const email = composeEmail({
      kind: 'support',
      contactName: 'Pastor Dan',
      senderName: 'Mark',
      checkInSummary: 'S.',
    })
    expect(email.subject).toBe('I need support right now')
    expect(email.body).toContain('Hi Pastor Dan,')
    expect(email.body).toContain('S.')
    expect(email.body).toContain('— Mark')
    expect(email.body).toContain('Sent through AMP: The Journey')
  })

  it('names the sender on check-in requests when known', () => {
    expect(composeEmail({ kind: 'check_in_request', contactName: 'A', senderName: 'Mark' }).body).toMatch(
      /^This is a message from Mark, who trusts you\./,
    )
    expect(composeEmail({ kind: 'check_in_request', contactName: 'A' }).body).toMatch(
      /^This is a message from someone who trusts you\./,
    )
  })
})

describe('toHtml', () => {
  it('escapes user-provided text', () => {
    const html = toHtml('Hi <script>alert(1)</script> & "you"')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;you&quot;')
  })
})
