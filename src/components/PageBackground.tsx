import { useLocation } from 'react-router'
import { paths } from '@/app/routes'

/**
 * Faded photo behind each screen. The photo sits under a heavy wash of the
 * theme's background color (navy in dark mode, soft grey-white in light), so
 * it reads as atmosphere and never competes with the text.
 */

const PHOTOS = {
  sunset: { src: '/backgrounds/sunset-study.webp', position: '22% 50%' },
  reflection: { src: '/backgrounds/quiet-reflection.webp', position: '30% 50%' },
  counsel: { src: '/backgrounds/pastoral-counsel.webp', position: '50% 40%' },
  screens: { src: '/backgrounds/screens.webp', position: '50% 50%' },
} as const

type Photo = keyof typeof PHOTOS

/** Which photo each screen uses. Screens not listed (Settings, Privacy) stay plain. */
const ROUTE_PHOTOS: Record<string, Photo> = {
  [paths.signIn]: 'sunset',
  [paths.resetPassword]: 'sunset',
  [paths.welcome]: 'sunset',
  [paths.home]: 'sunset',
  [paths.grounding]: 'sunset',
  [paths.identity]: 'sunset',
  [paths.checkIn]: 'reflection',
  [paths.journal]: 'reflection',
  [paths.resources]: 'counsel',
  [paths.library]: 'counsel',
  [paths.accountability]: 'counsel',
  [paths.triggers]: 'screens',
}

export function PageBackground() {
  const { pathname } = useLocation()
  const name = ROUTE_PHOTOS[pathname.toLowerCase()]
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
