/**
 * Content carried over verbatim from the original AMP app (Home).
 * Edit freely — this is the single source for this copy.
 */
import type { Track } from '@/data/types'

export interface DailyFocus {
  scripture: string
  text: string
  reflection: string
}

/** "Today's Focus" — rotates by day of month. */
export const DAILY_FOCUS: Record<Track, DailyFocus[]> = {
  men: [
    {
      scripture: 'Psalm 51:10',
      text: 'Create in me a clean heart, O God, and renew a right spirit within me.',
      reflection: 'Purity begins in the heart, not in behavior management. Let God search you today.',
    },
    {
      scripture: '2 Corinthians 5:17',
      text: 'Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.',
      reflection: 'Your identity is not defined by your struggle. You are being made new.',
    },
    {
      scripture: 'James 5:16',
      text: 'Therefore, confess your sins to one another and pray for one another, that you may be healed.',
      reflection: 'Healing happens in honest community. Who can you be real with today?',
    },
    {
      scripture: 'Romans 8:1',
      text: 'There is therefore now no condemnation for those who are in Christ Jesus.',
      reflection: 'Shame is not from God. Conviction leads to freedom; condemnation leads to hiding.',
    },
    {
      scripture: 'Isaiah 43:18-19',
      text: 'Remember not the former things, nor consider the things of old. Behold, I am doing a new thing.',
      reflection: 'God is not stuck in your past. Neither should you be.',
    },
    {
      scripture: 'Psalm 139:23-24',
      text: 'Search me, O God, and know my heart! Try me and know my thoughts!',
      reflection: 'Invite God into your inner world today. He already sees — and still loves.',
    },
    {
      scripture: 'Galatians 5:1',
      text: 'For freedom Christ has set us free; stand firm therefore, and do not submit again to a yoke of slavery.',
      reflection: 'Freedom is not just possible — it is your inheritance.',
    },
  ],
  spouse: [
    {
      scripture: 'Psalm 34:18',
      text: 'The Lord is near to the brokenhearted and saves the crushed in spirit.',
      reflection: 'Your pain is seen. God is close to you right now.',
    },
    {
      scripture: 'Psalm 46:1',
      text: 'God is our refuge and strength, a very present help in trouble.',
      reflection: "You don't have to hold it all together. Let God hold you.",
    },
    {
      scripture: 'Isaiah 41:10',
      text: 'Fear not, for I am with you; be not dismayed, for I am your God.',
      reflection: "Whatever you're feeling today — fear, anger, grief — God is with you in it.",
    },
    {
      scripture: 'Psalm 147:3',
      text: 'He heals the brokenhearted and binds up their wounds.',
      reflection: 'Healing is not instant, but it is real. Be gentle with yourself today.',
    },
    {
      scripture: 'Lamentations 3:22-23',
      text: 'The steadfast love of the Lord never ceases; his mercies never come to an end.',
      reflection: "Even when everything feels unstable, God's love is steady.",
    },
    {
      scripture: 'Psalm 62:1-2',
      text: 'For God alone my soul waits in silence; from him comes my salvation.',
      reflection: 'When the noise inside is loud, you can be still. God is working.',
    },
    {
      scripture: 'Romans 15:13',
      text: 'May the God of hope fill you with all joy and peace in believing.',
      reflection: 'Hope is not naive. It is anchored in who God is.',
    },
  ],
}

/** Encouragement banner — rotates by day of month + month. */
export const ENCOURAGEMENTS: Record<Track, string[]> = {
  men: [
    'You are not defined by your worst moments.',
    'Honesty is the beginning of freedom.',
    'One day at a time. One step at a time.',
    "God's grace is not just for the perfect — it's for the honest.",
    'Your identity is in Christ, not your struggle.',
    'Healing is slow, sacred work. Stay the course.',
    "You don't have to carry this alone.",
  ],
  spouse: [
    'Your pain is real, and it matters.',
    "You are not responsible for someone else's choices.",
    "It's okay to not be okay right now.",
    'You are stronger than you know — and God is stronger still.',
    "Your emotions make sense. Don't rush past them.",
    "Healing doesn't mean forgetting. It means finding your footing again.",
    'You deserve truth, safety, and care.',
  ],
}
