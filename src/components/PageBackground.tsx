import { useLocation } from 'react-router'
import { paths } from '@/app/routes'
import { useProfile } from '@/data/queries'
import { audienceFor, type Audience } from '@/lib/audience'
import { useAuth } from '@/lib/auth'

/**
 * Faded photo behind each screen. The photo sits under a heavy wash of the
 * theme's background color (navy in dark mode, soft grey-white in light), so
 * it reads as atmosphere and never competes with the text.
 *
 * Who sees what:
 * - a man working on his own recovery: men or nature
 * - a woman working on her own recovery: women or nature
 * - a betrayed spouse (man or woman): family, nature or faith-building
 * - anyone not known yet (signed out, setting up): nature only
 */

/** What a photo shows, which decides who may see it. */
type Subject = 'nature' | 'men' | 'women' | 'family' | 'faith'

const PHOTOS = {
  /** Sunset through a window, an open Bible and a mug. No people. */
  sunset: { src: '/backgrounds/sunset-study.webp', position: '22% 50%', subject: 'nature' },
  /** A woman at a table with her Bible and coffee. */
  reflection: { src: '/backgrounds/quiet-reflection.webp', position: '30% 50%', subject: 'women' },
  /** A married couple meeting with their pastor. */
  counsel: { src: '/backgrounds/pastoral-counsel.webp', position: '50% 40%', subject: 'family' },
  /** The same photo cropped to the pastor and the man. */
  counselMen: { src: '/backgrounds/pastoral-counsel-men.webp', position: '60% 40%', subject: 'men' },
} as const satisfies Record<string, { src: string; position: string; subject: Subject }>

export type Photo = keyof typeof PHOTOS

/** The kinds of photo each audience may see. */
const ALLOWED: Record<Audience, ReadonlySet<Subject>> = {
  man: new Set(['nature', 'men']),
  woman: new Set(['nature', 'women']),
  spouse: new Set(['nature', 'family', 'faith']),
  unknown: new Set(['nature']),
}

/** Calm screens use nature for everyone. */
const NATURE: Partial<Record<Audience, Photo>> = {}

/** Which photo each screen uses. Screens not listed (Settings, Privacy) stay plain. */
const ROUTE_PHOTOS: Record<string, Partial<Record<Audience, Photo>>> = {
  [paths.signIn]: NATURE,
  [paths.resetPassword]: NATURE,
  [paths.welcome]: NATURE,
  [paths.home]: NATURE,
  [paths.grounding]: NATURE,
  [paths.identity]: NATURE,
  [paths.triggers]: NATURE,
  // A text-heavy screen, so a calm photo without faces.
  [paths.group]: NATURE,
  [paths.checkIn]: { woman: 'reflection' },
  [paths.journal]: { woman: 'reflection' },
  [paths.resources]: { man: 'counselMen', woman: 'reflection', spouse: 'counsel' },
  [paths.library]: { man: 'counselMen', woman: 'reflection', spouse: 'counsel' },
  [paths.accountability]: { man: 'counselMen', woman: 'reflection', spouse: 'counsel' },
}

export function isAllowed(audience: Audience, photo: Photo): boolean {
  return ALLOWED[audience].has(PHOTOS[photo].subject)
}

/** The photo for a screen, or null for a plain screen. */
export function photoFor(pathname: string, audience: Audience): Photo | null {
  const choice = ROUTE_PHOTOS[pathname.toLowerCase()]
  if (!choice) return null
  const photo = choice[audience] ?? 'sunset'
  // Guard against a future mapping mistake ever showing someone a photo outside their set.
  return isAllowed(audience, photo) ? photo : 'sunset'
}

export function PageBackground() {
  const { pathname } = useLocation()
  const { state } = useAuth()
  const profile = useProfile({ enabled: state.status === 'signed-in' })
  const name = photoFor(pathname, audienceFor(profile.data))
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
