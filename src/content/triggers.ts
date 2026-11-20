/**
 * Content carried over verbatim from the original AMP app (Trigger Awareness).
 * Edit freely — this is the single source for this copy.
 */
import type { ResponsePattern, TriggerType } from '@/data/types'

export const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  {
    value: 'visual',
    label: 'Visual',
  },
  {
    value: 'emotional',
    label: 'Emotional',
  },
  {
    value: 'relational',
    label: 'Relational',
  },
  {
    value: 'situational',
    label: 'Situational',
  },
  {
    value: 'spiritual',
    label: 'Spiritual',
  },
  {
    value: 'physical',
    label: 'Physical',
  },
  {
    value: 'digital',
    label: 'Digital',
  },
  {
    value: 'other',
    label: 'Other',
  },
]

export const RESPONSE_PATTERNS: { value: Exclude<ResponsePattern, ''>; label: string }[] = [
  {
    value: 'healthy_coping',
    label: 'Healthy coping',
  },
  {
    value: 'avoidance',
    label: 'Avoidance',
  },
  {
    value: 'acting_out',
    label: 'Acting out',
  },
  {
    value: 'isolation',
    label: 'Isolation',
  },
  {
    value: 'reaching_out',
    label: 'Reaching out',
  },
  {
    value: 'grounding',
    label: 'Grounding',
  },
  {
    value: 'other',
    label: 'Other',
  },
]

export const TRIGGER_EMOTIONS = [
  'Anxious',
  'Angry',
  'Lonely',
  'Bored',
  'Tired',
  'Sad',
  'Overwhelmed',
  'Numb',
  'Ashamed',
  'Restless',
]
