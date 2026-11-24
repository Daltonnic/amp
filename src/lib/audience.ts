import type { Gender, Profile, Track } from '@/data/types'

/**
 * Who a screen is speaking to. The "men" track is the recovery track for
 * anyone working on their own freedom, so it splits by man or woman; the
 * spouse track is for betrayed spouses of either sex.
 */
export type Audience = 'man' | 'woman' | 'spouse' | 'unknown'

type ProfileLike = Pick<Profile, 'track'> & { gender?: Gender | null }

export function audienceFor(profile: ProfileLike | null | undefined): Audience {
  if (!profile) return 'unknown'
  if (profile.track === 'spouse') return 'spouse'
  if (profile.gender === 'man') return 'man'
  if (profile.gender === 'woman') return 'woman'
  return 'unknown'
}

/** True when a woman is on the recovery track, so "men" wording should read "women". */
export function isWoman(profile: ProfileLike | null | undefined): boolean {
  return profile?.track === 'men' && profile.gender === 'woman'
}

/** The recovery track's name as this person should see it. */
export function trackLabel(track: Track, gender: Gender | null | undefined): string {
  if (track === 'spouse') return 'Betrayed Spouse'
  return gender === 'woman' ? "Women's Formation" : "Men's Formation"
}

/** Label for the recovery track's tab in Resources and Library ("Men" or "Women"). */
export function recoveryTabLabel(profile: ProfileLike | null | undefined): string {
  return isWoman(profile) ? 'Women' : 'Men'
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'man', label: "I'm a man" },
  { value: 'woman', label: "I'm a woman" },
]
