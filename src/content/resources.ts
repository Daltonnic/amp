/**
 * Content carried over verbatim from the original AMP app (Resources).
 * Edit freely — this is the single source for this copy.
 */
import type { Track } from '@/data/types'

export interface ResourceCategory {
  category: string
  items: { title: string; content: string }[]
}

export const RESOURCES: Record<Track, ResourceCategory[]> = {
  men: [
    {
      category: 'Understanding Triggers',
      items: [
        {
          title: 'What Is a Trigger?',
          content:
            "A trigger is any stimulus — visual, emotional, relational, or situational — that activates a pattern of thought or behavior connected to sexual brokenness. Triggers are not the problem. They are signals. They tell you something deeper is happening.\n\nLearning to recognize triggers is not about avoidance alone — it's about awareness. When you can name what's pulling at you, you gain the ability to choose a different response.\n\nCommon triggers include:\n• Loneliness or isolation\n• Stress or unresolved anger\n• Visual stimuli (screens, environments)\n• Emotional flooding (shame, rejection, boredom)\n• Fatigue or physical depletion\n\nThe goal is not perfection. It's awareness.",
        },
        {
          title: 'The HALT Framework',
          content:
            'HALT stands for Hungry, Angry, Lonely, Tired. These are the four most common vulnerability states that lower your defenses.\n\nWhen you notice a trigger, ask yourself:\n• Am I Hungry? (Physically or emotionally?)\n• Am I Angry? (At someone? At myself? At God?)\n• Am I Lonely? (Disconnected? Isolated?)\n• Am I Tired? (Physically, emotionally, spiritually?)\n\nNaming these states gives you a moment of pause before reacting.',
        },
      ],
    },
    {
      category: 'Emotional Regulation',
      items: [
        {
          title: 'Why Emotions Matter',
          content:
            "Many of us were taught to suppress emotions — to push through, toughen up, or shut it down. But emotions are signals from God. They tell you what's happening inside.\n\nWhen emotions are suppressed, they don't disappear. They go underground. And they find other outlets — often destructive ones.\n\nLearning to feel is not weakness. It is courage. It is the beginning of real change.",
        },
        {
          title: 'The Window of Tolerance',
          content:
            "Your window of tolerance is the emotional zone where you can think clearly, respond appropriately, and stay present.\n\nAbove the window: hyperarousal — anxiety, panic, rage, impulsivity.\nBelow the window: hypoarousal — numbness, shutdown, disconnection, flatness.\n\nWhen you're outside your window, your brain shifts to survival mode. That's often when destructive patterns take over.\n\nGrounding tools help you return to your window. Awareness helps you recognize when you're leaving it.",
        },
      ],
    },
    {
      category: 'Rebuilding Spiritual Rhythms',
      items: [
        {
          title: 'Starting Small',
          content:
            "You don't need to have a two-hour prayer meeting to reconnect with God. Start with five minutes of honesty.\n\nTell God what you're feeling. Read one verse. Sit in silence. That's enough.\n\nSpiritual rhythms are not about performing for God. They are about making space for His presence. And presence changes everything.",
        },
        {
          title: "Prayer When You Don't Feel Like It",
          content:
            "Some of the most honest prayers are the ones that begin with 'God, I don't want to be here right now.'\n\nPrayer is not about saying the right words. It's about showing up — broken, confused, angry, or numb — and letting God meet you where you are.\n\nYou don't have to feel connected to be connected. Show up anyway.",
        },
      ],
    },
    {
      category: 'Honesty & Accountability',
      items: [
        {
          title: 'Why Secrecy is Deadly',
          content:
            "Addiction thrives in secrecy. The moment you bring something into the light, its power begins to diminish.\n\nThis doesn't mean telling everyone everything. It means having at least one trusted person who knows your real story.\n\nHonesty is terrifying — but it is also the doorway to freedom.",
        },
        {
          title: 'What Good Accountability Looks Like',
          content:
            "Real accountability is not a reporting system. It's a relationship.\n\nA good accountability partner:\n• Asks how you're really doing — not just what you've done\n• Creates safety, not shame\n• Listens without fixing\n• Points you to Christ, not performance\n• Holds the line with love\n\nYou need someone who can handle your truth.",
        },
      ],
    },
  ],
  spouse: [
    {
      category: 'Understanding Betrayal Trauma',
      items: [
        {
          title: 'What Is Betrayal Trauma?',
          content:
            'Betrayal trauma is the emotional and physiological response that occurs when someone you deeply trust violates that trust in a fundamental way.\n\nIt is not just hurt feelings. It is a trauma response — as real and disorienting as any other form of trauma. Your body, mind, and spirit are all affected.\n\nSymptoms often include:\n• Intrusive thoughts and images\n• Hypervigilance and anxiety\n• Emotional flooding\n• Physical symptoms (nausea, insomnia, chest tightness)\n• Difficulty concentrating\n• Feelings of unreality\n\nYou are not overreacting. Your body is trying to protect you.',
        },
        {
          title: 'This Is Not Your Fault',
          content:
            "You did not cause this. No amount of beauty, attentiveness, or spiritual devotion could have prevented your spouse's choices.\n\nBetrayal is a choice made by the person who betrayed. Not a reflection of your worth.\n\nYou may hear voices — internal or external — suggesting you could have done something different. That is a lie. The responsibility belongs where the choice was made.",
        },
      ],
    },
    {
      category: 'Normalizing Emotions',
      items: [
        {
          title: 'Your Feelings Make Sense',
          content:
            "Anger. Grief. Fear. Numbness. Confusion. Rage. Sadness.\n\nAll of these are normal responses to an abnormal situation. You are not crazy. You are not weak. You are responding to a wound.\n\nSome days you'll feel all of these within an hour. Other days you'll feel nothing. Both are normal.\n\nDon't judge your healing by your emotions. Just let yourself feel them — and know they will not consume you.",
        },
        {
          title: 'Emotional Waves',
          content:
            "Trauma emotions don't follow a neat timeline. They come in waves.\n\nYou may feel fine one hour and devastated the next. A song, a smell, a memory — anything can bring it rushing back.\n\nThis does not mean you're not healing. It means you're human. The waves get further apart over time. But they may always come. And when they do, you ride them — not run from them.",
        },
      ],
    },
    {
      category: 'Stabilizing During Triggers',
      items: [
        {
          title: "When You're Triggered",
          content:
            "A trigger is a sensory or emotional reminder that activates your trauma response. It can be a phone notification, a certain look, a time of day, or a location.\n\nWhen triggered:\n1. Pause. Name what's happening: 'I am being triggered.'\n2. Ground yourself. Feel your feet. Breathe slowly.\n3. Remind yourself: 'I am safe right now.'\n4. Do not make major decisions while triggered.\n5. Reach out to a safe person if you need to.\n\nYou are learning to live with a rewired nervous system. It takes time.",
        },
      ],
    },
    {
      category: 'Caring for Yourself',
      items: [
        {
          title: 'Self-Care Is Not Selfish',
          content:
            "In the aftermath of betrayal, you may have lost yourself entirely in someone else's crisis. You deserve care.\n\nSelf-care means:\n• Getting enough sleep\n• Eating regular meals\n• Moving your body gently\n• Saying no when you need to\n• Asking for help\n• Being honest about your limits\n\nYou cannot heal from a place of depletion. Take care of you.",
        },
        {
          title: 'Boundaries Are Love',
          content:
            "Setting boundaries is not punishment. It is self-preservation.\n\nBoundaries say: 'I will not participate in my own harm.' They protect your heart, your healing, and your dignity.\n\nBoundaries are not walls. They are fences — with gates. You decide who gets access. And that is your right.",
        },
      ],
    },
  ],
}
