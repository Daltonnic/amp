/**
 * Content carried over verbatim from the original AMP app (Identity & Scripture).
 * Edit freely — this is the single source for this copy.
 */

export interface IdentityItem {
  /** For "Scripture Meditation" this holds the reference and `scripture` holds the verse. */
  truth: string
  scripture: string
  reflection: string
}

export const IDENTITY_SECTIONS: { title: string; items: IdentityItem[] }[] = [
  {
    title: 'Identity in Christ',
    items: [
      {
        truth: 'I am a child of God.',
        scripture: 'John 1:12',
        reflection: 'You are not an orphan. You are not on your own. You belong to the Father.',
      },
      {
        truth: 'I am forgiven — completely.',
        scripture: 'Ephesians 1:7',
        reflection:
          'Forgiveness is not something you earn. It is something you receive. And it changes everything.',
      },
      {
        truth: 'I am a new creation.',
        scripture: '2 Corinthians 5:17',
        reflection: 'The old patterns, the old identity — they do not own you anymore. You are being remade.',
      },
      {
        truth: 'I am chosen and loved.',
        scripture: '1 Peter 2:9',
        reflection: "God didn't choose you because you had it together. He chose you because He loves you.",
      },
      {
        truth: "Nothing can separate me from God's love.",
        scripture: 'Romans 8:38-39',
        reflection: 'Not your failures. Not your shame. Not your darkest day. Nothing.',
      },
    ],
  },
  {
    title: 'Sonship & Security',
    items: [
      {
        truth: 'God is not disappointed in you.',
        scripture: 'Zephaniah 3:17',
        reflection: 'He rejoices over you — not in spite of your weakness, but in the midst of it.',
      },
      {
        truth: 'You have direct access to the Father.',
        scripture: 'Hebrews 4:16',
        reflection: "You don't have to clean up before you come to Him. Come as you are.",
      },
      {
        truth: 'You are being transformed, not performing.',
        scripture: 'Philippians 1:6',
        reflection: "The work in you is God's work. Trust the process.",
      },
      {
        truth: 'Your worth is not based on your behavior.',
        scripture: 'Romans 5:8',
        reflection: 'God loved you before you changed. His love is not a reward — it is the foundation.',
      },
    ],
  },
  {
    title: 'Scripture Meditation',
    items: [
      {
        truth: 'Psalm 139:14',
        scripture: 'I am fearfully and wonderfully made.',
        reflection: 'Sit with this. You are not an accident. Your life has purpose and design.',
      },
      {
        truth: 'Isaiah 43:4',
        scripture: 'You are precious in my eyes, and honored, and I love you.',
        reflection: 'This is God speaking to you — right now, as you are.',
      },
      {
        truth: 'Jeremiah 29:11',
        scripture: 'For I know the plans I have for you, declares the Lord.',
        reflection: 'There is a future. There is hope. And God is already in it.',
      },
      {
        truth: 'Psalm 103:12',
        scripture: 'As far as the east is from the west, so far does he remove our transgressions from us.',
        reflection: 'If God has removed it, stop picking it back up.',
      },
    ],
  },
]
