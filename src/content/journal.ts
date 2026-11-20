/**
 * Content carried over verbatim from the original AMP app (Journal).
 * Edit freely — this is the single source for this copy.
 */
import type { Track } from '@/data/types'
import type { Option } from './onboarding'

export const PROMPTS: Record<Track, Record<string, string[]>> = {
  men: {
    emotional_processing: [
      'What am I really feeling right now — underneath the surface?',
      'When did I last feel truly at peace? What was different?',
      'What emotion am I avoiding today?',
      'If I could say one honest thing, what would it be?',
    ],
    identity_reflection: [
      'Who does God say I am — apart from my struggle?',
      'What lie about myself do I keep believing?',
      'What would it look like to live from identity instead of behavior?',
      'How has shame shaped the way I see myself?',
    ],
    fears_stressors: [
      'What am I most afraid of right now?',
      "What stress is sitting on me that I haven't named?",
      'If I let go of control, what would happen?',
      "Where am I carrying weight that isn't mine?",
    ],
    spiritual_reflection: [
      'Where do I sense God in my life today?',
      "What's the hardest thing to bring to God right now?",
      "How would my life change if I truly believed God wasn't disappointed in me?",
      'What would surrender look like today?',
    ],
    pattern_awareness: [
      'What patterns do I notice before I struggle?',
      'When am I most vulnerable — and what makes it worse?',
      'What was I really looking for the last time I stumbled?',
      'What healthy response can I practice the next time I drift?',
    ],
  },
  spouse: {
    grief_anger: [
      "What have I lost that I haven't fully named yet?",
      'Where is my anger right now? Is it protecting something deeper?',
      'What do I wish I could say to someone — honestly?',
      'What part of my grief scares me the most?',
    ],
    questions_confusion: [
      'What question keeps circling in my mind?',
      'What do I wish someone would tell me right now?',
      'What am I most confused about today?',
      'If I could know one thing for sure, what would it be?',
    ],
    emotional_clarity: [
      'What am I feeling right now — without filtering it?',
      'What emotion do I keep pushing down?',
      "What does my body tell me that my mind won't admit?",
      'What would it feel like to just let myself feel this?',
    ],
    stabilization: [
      'What helped me feel grounded today?',
      'What was one small good thing that happened?',
      'What do I need to let go of before I sleep tonight?',
      'What am I grateful for — even in this pain?',
    ],
  },
}

export const CATEGORIES: Record<Track, Option[]> = {
  men: [
    {
      value: 'emotional_processing',
      label: 'Emotional Processing',
    },
    {
      value: 'identity_reflection',
      label: 'Identity Reflection',
    },
    {
      value: 'fears_stressors',
      label: 'Fears & Stressors',
    },
    {
      value: 'spiritual_reflection',
      label: 'Spiritual Reflection',
    },
    {
      value: 'pattern_awareness',
      label: 'Pattern Awareness',
    },
    {
      value: 'free_writing',
      label: 'Free Writing',
    },
  ],
  spouse: [
    {
      value: 'grief_anger',
      label: 'Grief & Anger',
    },
    {
      value: 'questions_confusion',
      label: 'Questions & Confusion',
    },
    {
      value: 'emotional_clarity',
      label: 'Emotional Clarity',
    },
    {
      value: 'stabilization',
      label: 'Stabilization',
    },
    {
      value: 'free_writing',
      label: 'Free Writing',
    },
  ],
}

export interface JournalTemplate {
  id: string
  label: string
  icon: 'sunrise' | 'moon'
  description: string
  category: string
  prompts: string[]
}

export const TEMPLATES: Record<string, JournalTemplate> = {
  morning_gratitude: {
    id: 'morning_gratitude',
    label: 'Morning Gratitude',
    icon: 'sunrise',
    description: "Start your day grounded in what's good.",
    category: 'spiritual_reflection',
    prompts: [
      "What is one thing I'm grateful for today — even if it's small?",
      "What do I need from God today that I haven't asked for?",
      'Who in my life am I thankful for, and why?',
      "What good thing happened yesterday that I didn't fully acknowledge?",
      "What is one thing I'm looking forward to today?",
    ],
  },
  evening_recovery: {
    id: 'evening_recovery',
    label: 'Evening Recovery',
    icon: 'moon',
    description: 'Process your day and release it before rest.',
    category: 'pattern_awareness',
    prompts: [
      'How did I do today — honestly, not harshly?',
      'Where did I feel most tempted or vulnerable today?',
      'What emotion am I carrying into tonight that needs to be named?',
      'What moment today am I proud of?',
      'What do I need to let go of before I sleep?',
    ],
  },
}
