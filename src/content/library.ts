/**
 * Content carried over verbatim from the original AMP app (Library).
 * Edit freely — this is the single source for this copy.
 */
import type { LibraryCategory } from '@/data/types'

export const LIBRARY_CATEGORIES: Record<LibraryCategory, string> = {
  scripture_teaching: 'Scripture Teaching',
  recovery: 'Recovery',
  emotional_health: 'Emotional Health',
  spiritual_formation: 'Spiritual Formation',
  spouse_support: 'Spouse Support',
  identity: 'Identity',
  accountability: 'Accountability',
}

export const LIBRARY_CATEGORY_ORDER = Object.keys(LIBRARY_CATEGORIES) as LibraryCategory[]
