import { describe, expect, it } from 'vitest'
import { photoFor } from '@/components/PageBackground'

const ALL_ROUTES = [
  '/sign-in',
  '/reset-password',
  '/welcome',
  '/home',
  '/grounding',
  '/identity',
  '/check-in',
  '/journal',
  '/resources',
  '/library',
  '/accountability',
  '/triggers',
]

describe('page backgrounds', () => {
  it('never shows the men’s track a photo with women or phone-scrolling', () => {
    for (const route of ALL_ROUTES) {
      expect(['sunset', 'counselMen']).toContain(photoFor(route, 'men'))
    }
  })

  it('treats an unknown track (signed out, onboarding) like the men’s track', () => {
    for (const route of ALL_ROUTES) {
      expect(['sunset', 'counselMen']).toContain(photoFor(route, null))
    }
  })

  it('keeps the full set for the spouse track', () => {
    expect(photoFor('/journal', 'spouse')).toBe('reflection')
    expect(photoFor('/accountability', 'spouse')).toBe('counsel')
    expect(photoFor('/triggers', 'spouse')).toBe('screens')
  })

  it('leaves Settings and Privacy plain', () => {
    expect(photoFor('/settings', 'men')).toBeNull()
    expect(photoFor('/privacy', 'spouse')).toBeNull()
  })
})
