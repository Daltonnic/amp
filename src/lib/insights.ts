import type { WeekDay } from '@/data/queries'
import type { Track } from '@/data/types'

export type Trend = 'rising' | 'declining' | 'stable'

/**
 * The value each track's trend follows. Spouses rate intensity; men rate
 * temptation and stress. (The original app charted an "intensity" for men
 * that they were never asked for, so it always sat at 5.)
 */
export function trendValue(day: WeekDay, track: Track): number | null {
  return track === 'spouse' ? day.intensity : day.temptation
}

/**
 * Compares the most recent logged value with the average of the two before
 * it. A change of 1.5 or more counts as rising/declining. Needs three days.
 */
export function computeTrend(days: WeekDay[], track: Track): Trend | null {
  const values = days
    .filter((d) => d.hasData)
    .map((d) => trendValue(d, track))
    .filter((v): v is number => v !== null)
  if (values.length < 3) return null
  const [a, b, latest] = values.slice(-3) as [number, number, number]
  const prior = (a + b) / 2
  if (latest - prior >= 1.5) return 'rising'
  if (prior - latest >= 1.5) return 'declining'
  return 'stable'
}

/** Most frequent emotion of the week; ties go to the most recent. */
export function mostFrequentEmotion(days: WeekDay[]): string | null {
  const counts = new Map<string, number>()
  for (const d of days) if (d.emotion) counts.set(d.emotion, (counts.get(d.emotion) ?? 0) + 1)
  let best: string | null = null
  let bestCount = 0
  for (const d of [...days].reverse()) {
    if (!d.emotion) continue
    const c = counts.get(d.emotion) ?? 0
    if (c > bestCount) {
      best = d.emotion
      bestCount = c
    }
  }
  return best
}
