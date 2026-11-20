import { describe, expect, it } from 'vitest'
import type { WeekDay } from '@/data/queries'
import { computeTrend, mostFrequentEmotion } from '@/lib/insights'

const day = (i: number, over: Partial<WeekDay> = {}): WeekDay => ({
  day: `D${i}`,
  date: `2026-11-${String(10 + i).padStart(2, '0')}`,
  intensity: null,
  temptation: null,
  stress: null,
  emotion: null,
  hasData: false,
  ...over,
})

describe('computeTrend', () => {
  it('needs at least three logged days', () => {
    expect(
      computeTrend(
        [day(0, { hasData: true, intensity: 4 }), day(1, { hasData: true, intensity: 9 })],
        'spouse',
      ),
    ).toBeNull()
  })

  it('detects rising intensity for spouses', () => {
    const days = [4, 4, 7].map((v, i) => day(i, { hasData: true, intensity: v }))
    expect(computeTrend(days, 'spouse')).toBe('rising')
  })

  it('detects declining intensity', () => {
    const days = [8, 7, 5].map((v, i) => day(i, { hasData: true, intensity: v }))
    expect(computeTrend(days, 'spouse')).toBe('declining')
  })

  it('reports stable within 1.5 points', () => {
    const days = [5, 6, 6].map((v, i) => day(i, { hasData: true, intensity: v }))
    expect(computeTrend(days, 'spouse')).toBe('stable')
  })

  it('follows temptation (not the unused intensity) for men', () => {
    const days = [2, 2, 6].map((v, i) => day(i, { hasData: true, temptation: v, intensity: null }))
    expect(computeTrend(days, 'men')).toBe('rising')
  })

  it('ignores days without data in between', () => {
    const days = [
      day(0, { hasData: true, intensity: 3 }),
      day(1),
      day(2, { hasData: true, intensity: 3 }),
      day(3),
      day(4, { hasData: true, intensity: 9 }),
    ]
    expect(computeTrend(days, 'spouse')).toBe('rising')
  })
})

describe('mostFrequentEmotion', () => {
  it('returns null with no emotions', () => {
    expect(mostFrequentEmotion([day(0), day(1)])).toBeNull()
  })

  it('returns the most common emotion', () => {
    const days = ['Anxious', 'Hopeful', 'Anxious'].map((e, i) => day(i, { emotion: e, hasData: true }))
    expect(mostFrequentEmotion(days)).toBe('Anxious')
  })

  it('breaks ties in favor of the most recent day', () => {
    const days = ['Anxious', 'Hopeful'].map((e, i) => day(i, { emotion: e, hasData: true }))
    expect(mostFrequentEmotion(days)).toBe('Hopeful')
  })
})
