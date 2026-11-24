/**
 * Content carried over verbatim from the original AMP app (Onboarding).
 * Edit freely — this is the single source for this copy.
 */
import type { Track } from '@/data/types'

export interface Option {
  value: string
  label: string
}

export const ONBOARDING_STEPS: { id: string; title: string; subtitle: string }[] = [
  {
    id: 'welcome',
    title: 'Welcome to The Journey',
    subtitle: 'A place of formation, healing, and hope.',
  },
  {
    id: 'name',
    title: "What's your name?",
    subtitle: 'Your first name is required. You choose how it shows to others.',
  },
  {
    id: 'about',
    title: 'A little about you',
    subtitle: 'This helps us choose the right words and pictures for you.',
  },
  {
    id: 'track',
    title: 'Who is this for?',
    subtitle: 'This helps us tailor your experience.',
  },
  {
    id: 'reason',
    title: 'What brings you here?',
    subtitle: "There's no wrong answer. Be honest.",
  },
  {
    id: 'need',
    title: 'What do you need most right now?',
    subtitle: "We'll shape your dashboard around this.",
  },
  {
    id: 'reminders',
    title: 'Daily Reminders',
    subtitle: 'Gentle nudges to pause and check in.',
  },
]

/** "What do you need most right now?" — select up to 3. */
export const NEEDS: Record<Track, Option[]> = {
  men: [
    {
      value: 'awareness',
      label: 'Growing in self-awareness',
    },
    {
      value: 'stability',
      label: 'Stabilizing daily rhythms',
    },
    {
      value: 'grounding',
      label: 'Grounding during triggers',
    },
    {
      value: 'connection',
      label: 'Reconnecting with God',
    },
    {
      value: 'identity',
      label: 'Strengthening identity in Christ',
    },
    {
      value: 'healing',
      label: 'Healing at a deeper level',
    },
  ],
  spouse: [
    {
      value: 'grounding',
      label: 'Grounding and stabilization',
    },
    {
      value: 'validation',
      label: 'Emotional validation',
    },
    {
      value: 'clarity',
      label: 'Clarity and understanding',
    },
    {
      value: 'safety',
      label: 'Feeling safe again',
    },
    {
      value: 'spiritual',
      label: 'Spiritual support',
    },
    {
      value: 'self_care',
      label: 'Caring for myself',
    },
  ],
}

export const REMINDER_EXAMPLES = [
  '"Pause and check your heart."',
  '"Take a moment to breathe."',
  '"You are not alone."',
]
