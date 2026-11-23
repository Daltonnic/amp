import { useLocation } from 'react-router'
import { paths } from '@/app/routes'
import { useProfile } from '@/data/queries'
import type { Track } from '@/data/types'
import { useAuth } from '@/lib/auth'

/**
 * Faded photo behind each screen. The photo sits under a heavy wash of the
 * theme's background color (navy in dark mode, soft grey-white in light), so
 * it reads as atmosphere and never competes with the text.
 *
 * The men's track (and anyone whose track isn't known yet) only ever sees
 * photos without women in them, and never the photo of someone scrolling a
 * phone. The spouse track uses the full set.
 */

const PHOTOS = {
  sunset: { src: '/backgrounds/sunset-study.webp', position: '22% 50%' },
  reflection: { src: '/backgrounds/quiet-reflection.webp', position: '30% 50%' },
  counsel: { src: '/backgrounds/pastoral-counsel.webp', position: '50% 40%' },
  /** Cropped to the pastor and the man only. */
  counselMen: { src: '/backgrounds/pastoral-counsel-men.webp', position: '60% 40%' },
  screens: { src: '/backgrounds/screens.webp', position: '50% 50%' },
} as const

type Photo = keyof typeof PHOTOS

/** Photos the men's track may see: no women, no phone-scrolling. */
const MEN_SAFE: ReadonlySet<Photo> = new Set<Photo>(['sunset', 'counselMen'])

/** Which photo each screen uses, per track. Screens not listed (Settings, Privacy) stay plain. */
const ROUTE_PHOTOS: Record<string, Record<Track, Photo>> = {
  [paths.signIn]: { men: 'sunset', spouse: 'sunset' },
  [paths.resetPassword]: { men: 'sunset', spouse: 'sunset' },
  [paths.welcome]: { men: 'sunset', spouse: 'sunset' },
  [paths.home]: { men: 'sunset', spouse: 'sunset' },
  [paths.grounding]: { men: 'sunset', spouse: 'sunset' },
  [paths.identity]: { men: 'sunset', spouse: 'sunset' },
  [paths.checkIn]: { men: 'sunset', spouse: 'reflection' },
  [paths.journal]: { men: 'sunset', spouse: 'reflection' },
  [paths.resources]: { men: 'counselMen', spouse: 'counsel' },
  [paths.library]: { men: 'counselMen', spouse: 'counsel' },
  [paths.accountability]: { men: 'counselMen', spouse: 'counsel' },
  [paths.triggers]: { men: 'sunset', spouse: 'screens' },
}

/** The photo for a screen. Unknown track is treated as the men's track. */
export function photoFor(pathname: string, track: Track | null): Photo | null {
  const choice = ROUTE_PHOTOS[pathname.toLowerCase()]
  if (!choice) return null
  const photo = choice[track ?? 'men']
  // Guard against a future mapping mistake ever showing men a restricted photo.
  return track === 'spouse' || MEN_SAFE.has(photo) ? photo : 'sunset'
}

export function PageBackground() {
  const { pathname } = useLocation()
  const { state } = useAuth()
  const profile = useProfile({ enabled: state.status === 'signed-in' })
  const name = photoFor(pathname, profile.data?.track ?? null)
  if (!name) return null
  const photo = PHOTOS[name]
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <img
        key={photo.src}
        src={photo.src}
        alt=""
        decoding="async"
        draggable={false}
        className="size-full animate-in object-cover fade-in duration-700"
        style={{ objectPosition: photo.position }}
      />
      <div className="page-photo-fade absolute inset-0" />
    </div>
  )
}
