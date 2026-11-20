/**
 * Content carried over verbatim from the original AMP app (Check-In).
 * Edit freely — this is the single source for this copy.
 */
import type { Track } from '@/data/types'

export const EMOTIONS: Record<Track, string[]> = {
  men: [
    'Peaceful',
    'Anxious',
    'Tempted',
    'Angry',
    'Lonely',
    'Grateful',
    'Ashamed',
    'Hopeful',
    'Numb',
    'Overwhelmed',
    'Restless',
    'Discouraged',
    'Determined',
    'Afraid',
    'Content',
  ],
  spouse: [
    'Grieving',
    'Angry',
    'Numb',
    'Anxious',
    'Confused',
    'Betrayed',
    'Afraid',
    'Overwhelmed',
    'Hopeful',
    'Exhausted',
    'Sad',
    'Triggered',
    'Peaceful',
    'Lonely',
    'Determined',
  ],
}

/** Men: "Where are you spiritually?" */
export const SPIRITUAL_CONDITIONS = ['connected', 'distant', 'struggling', 'numb', 'seeking']

/** Spouse: "What do you need right now?" */
export const CURRENT_NEEDS = ['comfort', 'space', 'reassurance', 'grounding', 'clarity']

/** Spouse: "Where do you feel this in your body?" */
export const BODY_AREAS = [
  'Chest',
  'Stomach',
  'Throat',
  'Head',
  'Shoulders',
  'Hands',
  'Whole body',
  'Nowhere specific',
]
