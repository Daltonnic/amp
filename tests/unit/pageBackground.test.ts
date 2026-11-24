import { describe, expect, it } from 'vitest'
import { isAllowed, photoFor, type Photo } from '@/components/PageBackground'
import { audienceFor, recoveryTabLabel, trackLabel, type Audience } from '@/lib/audience'

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

function photosSeenBy(audience: Audience): Set<Photo | null> {
  return new Set(ALL_ROUTES.map((route) => photoFor(route, audience)))
}

describe('audience', () => {
  it('splits the recovery track by man or woman, and keeps spouses together', () => {
    expect(audienceFor({ track: 'men', gender: 'man' })).toBe('man')
    expect(audienceFor({ track: 'men', gender: 'woman' })).toBe('woman')
    expect(audienceFor({ track: 'spouse', gender: 'man' })).toBe('spouse')
    expect(audienceFor({ track: 'spouse', gender: 'woman' })).toBe('spouse')
    expect(audienceFor({ track: 'men', gender: null })).toBe('unknown')
    expect(audienceFor(null)).toBe('unknown')
  })

  it('names the recovery track for women as Women’s Formation', () => {
    expect(trackLabel('men', 'woman')).toBe("Women's Formation")
    expect(trackLabel('men', 'man')).toBe("Men's Formation")
    expect(trackLabel('spouse', 'woman')).toBe('Betrayed Spouse')
    expect(recoveryTabLabel({ track: 'men', gender: 'woman' })).toBe('Women')
    expect(recoveryTabLabel({ track: 'spouse', gender: 'woman' })).toBe('Men')
  })
})

describe('page backgrounds', () => {
  it('shows a man in recovery only men or nature', () => {
    for (const photo of photosSeenBy('man')) expect(['sunset', 'counselMen']).toContain(photo)
    expect(photoFor('/accountability', 'man')).toBe('counselMen')
  })

  it('shows a woman in recovery only women or nature', () => {
    for (const photo of photosSeenBy('woman')) expect(['sunset', 'reflection']).toContain(photo)
    expect(photoFor('/journal', 'woman')).toBe('reflection')
  })

  it('shows a betrayed spouse only family, nature or faith-building', () => {
    for (const photo of photosSeenBy('spouse')) expect(['sunset', 'counsel']).toContain(photo)
    expect(photoFor('/resources', 'spouse')).toBe('counsel')
  })

  it('shows only nature before we know who someone is', () => {
    expect(photosSeenBy('unknown')).toEqual(new Set(['sunset']))
  })

  it('never lets one audience see another audience’s people photos', () => {
    expect(isAllowed('man', 'reflection')).toBe(false)
    expect(isAllowed('man', 'counsel')).toBe(false)
    expect(isAllowed('woman', 'counselMen')).toBe(false)
    expect(isAllowed('woman', 'counsel')).toBe(false)
    expect(isAllowed('spouse', 'reflection')).toBe(false)
    expect(isAllowed('spouse', 'counselMen')).toBe(false)
  })

  it('leaves Settings and Privacy plain', () => {
    expect(photoFor('/settings', 'man')).toBeNull()
    expect(photoFor('/privacy', 'spouse')).toBeNull()
  })
})
