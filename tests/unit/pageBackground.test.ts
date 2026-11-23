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
  it('never shows the men’s track a woman on her own or phone-scrolling', () => {
    for (const route of ALL_ROUTES) {
      expect(['sunset', 'counsel']).toContain(photoFor(route, 'men'))
    }
  })

  it('treats an unknown track (signed out, onboarding) like the men’s track', () => {
    for (const route of ALL_ROUTES) {
      expect(['sunset', 'counsel']).toContain(photoFor(route, null))
    }
  })

  it('keeps the full set for the spouse track', () => {
    expect(photoFor('/journal', 'spouse')).toBe('reflection')
    expect(photoFor('/accountability', 'spouse')).toBe('counsel')
    expect(photoFor('/triggers', 'spouse')).toBe('screens')
  })

  it('shows men the family picture (couple with their pastor) on support screens', () => {
    expect(photoFor('/accountability', 'men')).toBe('counsel')
    expect(photoFor('/journal', 'men')).toBe('sunset')
    expect(photoFor('/triggers', 'men')).toBe('sunset')
  })

  it('leaves Settings and Privacy plain', () => {
    expect(photoFor('/settings', 'men')).toBeNull()
    expect(photoFor('/privacy', 'spouse')).toBeNull()
  })
})
