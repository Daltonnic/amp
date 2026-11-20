/**
 * Content carried over verbatim from the original AMP app (Grounding).
 * Edit freely — this is the single source for this copy.
 */
import type { Track } from '@/data/types'

export interface BreathingPhase {
  name: string
  duration: number
  instruction: string
}

export interface GuidedStep {
  instruction: string
  detail: string
}

export const BREATHING_PHASES: BreathingPhase[] = [
  {
    name: 'Breathe In',
    duration: 4000,
    instruction: 'Slowly breathe in through your nose',
  },
  {
    name: 'Hold',
    duration: 4000,
    instruction: 'Hold gently',
  },
  {
    name: 'Breathe Out',
    duration: 6000,
    instruction: 'Release slowly through your mouth',
  },
  {
    name: 'Rest',
    duration: 2000,
    instruction: 'Be still',
  },
]

/** 5-4-3-2-1 senses exercise. */
export const ORIENTING_STEPS: GuidedStep[] = [
  {
    instruction: 'Name 5 things you can see',
    detail: "Look around slowly. What's in front of you?",
  },
  {
    instruction: 'Name 4 things you can touch',
    detail: 'Feel the texture of something near you.',
  },
  {
    instruction: 'Name 3 things you can hear',
    detail: 'Listen carefully. What sounds surround you?',
  },
  {
    instruction: 'Name 2 things you can smell',
    detail: 'Breathe in deeply. What do you notice?',
  },
  {
    instruction: 'Name 1 thing you can taste',
    detail: "What's the taste in your mouth right now?",
  },
]

export const BODY_STEPS: GuidedStep[] = [
  {
    instruction: 'Place both feet flat on the floor',
    detail: 'Feel the ground beneath you. You are here.',
  },
  {
    instruction: 'Press your palms together firmly',
    detail: 'Hold for 10 seconds. Feel the pressure.',
  },
  {
    instruction: 'Roll your shoulders back slowly',
    detail: "Release any tension you're holding.",
  },
  {
    instruction: 'Unclench your jaw',
    detail: 'Let your face relax. Soften your eyes.',
  },
  {
    instruction: 'Take one long, deep breath',
    detail: 'Breathe in through your nose. Out through your mouth.',
  },
]

export const PRAYERS: Record<Track, { title: string; text: string }[]> = {
  men: [
    {
      title: 'A Prayer for Clarity',
      text: "Lord, search my heart. Show me what I'm hiding from. Give me the courage to be honest — with You, with myself, and with someone I trust. I don't want to perform. I want to be free. Help me stay present. Amen.",
    },
    {
      title: 'A Prayer in Temptation',
      text: 'Father, I feel the pull right now. I know where this leads. Help me pause. Help me breathe. Remind me who I am in You — not what I want to run to. I choose You in this moment. Amen.',
    },
    {
      title: 'A Prayer for Strength',
      text: 'God, I am tired. The fight feels long. But You have not given up on me. Renew my strength today. Help me take the next right step — not the whole journey, just this step. Amen.',
    },
  ],
  spouse: [
    {
      title: 'A Prayer in Pain',
      text: "Lord, this hurts more than I can say. I don't know how to carry this. Hold me together when I feel like falling apart. Let me feel safe in Your presence even when everything else feels unsafe. Amen.",
    },
    {
      title: 'A Prayer for Peace',
      text: "Father, my mind won't stop. The images, the questions, the fear — it's all so loud. Quiet the storm inside me. I don't need answers right now. I need Your peace. Amen.",
    },
    {
      title: 'A Prayer for Clarity',
      text: "God, I don't know what to feel or what to do. Help me not to rush. Help me not to shut down. Give me wisdom one day at a time. I trust You even when I can't trust anything else. Amen.",
    },
  ],
}

export const TRUTHS: Record<Track, string[]> = {
  men: [
    'You are a new creation in Christ. Your past does not define you.',
    'God is not ashamed of you. He is for you.',
    'Freedom is not earned — it is received. And you are receiving it.',
    'Your struggle does not disqualify you. God uses broken people.',
    'You are loved — not because of what you do, but because of who you are.',
    "The enemy wants you to believe you're too far gone. That is a lie.",
    'Healing is possible. And it has already begun.',
  ],
  spouse: [
    'This is not your fault. You did not cause this.',
    'Your pain is real and it matters to God.',
    "You are allowed to feel everything you're feeling.",
    'You are not alone, even when it feels that way.',
    'You are not broken. You are wounded. And wounds heal.',
    "You don't have to figure everything out today.",
    'God sees you. He is near to the brokenhearted.',
  ],
}

export const GROUNDING_SCRIPTURES: Record<Track, { ref: string; text: string }[]> = {
  men: [
    {
      ref: 'Psalm 23',
      text: 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.',
    },
    {
      ref: 'Isaiah 40:31',
      text: 'But they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint.',
    },
    {
      ref: 'Philippians 4:6-7',
      text: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.',
    },
  ],
  spouse: [
    {
      ref: 'Psalm 91:1-2',
      text: "He who dwells in the shelter of the Most High will abide in the shadow of the Almighty. I will say to the Lord, 'My refuge and my fortress, my God, in whom I trust.'",
    },
    {
      ref: 'Psalm 55:22',
      text: 'Cast your burden on the Lord, and he will sustain you; he will never permit the righteous to be moved.',
    },
    {
      ref: 'Isaiah 43:2',
      text: 'When you pass through the waters, I will be with you; and through the rivers, they shall not overwhelm you.',
    },
  ],
}

/** Spouse track only. */
export const REASSURANCES: string[] = [
  'You are safe right now, in this moment.',
  "What you're feeling makes sense. It's a normal response to pain.",
  "You don't have to figure this out right now.",
  'You are allowed to take as much time as you need.',
  'This moment will pass. You will get through this.',
  'You are not crazy. Your body is trying to protect you.',
  'It is okay to need help. Reaching out is strength.',
]
