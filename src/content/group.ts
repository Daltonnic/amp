import type { Gender, GroupRoomId, Track } from '@/data/types'

/** The four groups. Mirrors public.chat_rooms. */
export const GROUP_ROOMS: Record<GroupRoomId, { name: string; description: string }> = {
  'men-recovery': {
    name: 'Men in Recovery',
    description: 'Men walking toward freedom together.',
  },
  'women-recovery': {
    name: 'Women in Recovery',
    description: 'Women walking toward freedom together.',
  },
  'men-betrayed': {
    name: 'Men Healing from Betrayal',
    description: "Men finding steady ground after a spouse's betrayal.",
  },
  'women-betrayed': {
    name: 'Women Healing from Betrayal',
    description: "Women finding steady ground after a spouse's betrayal.",
  },
}

/** Mirrors public.chat_room_for(). */
export function roomFor(track: Track, gender: Gender | null | undefined): GroupRoomId | null {
  if (gender !== 'man' && gender !== 'woman') return null
  const who = gender === 'man' ? 'men' : 'women'
  return `${who}-${track === 'spouse' ? 'betrayed' : 'recovery'}` as GroupRoomId
}

/** Shown before joining. Members agree to these. */
export const GROUP_GUIDELINES: { title: string; text: string }[] = [
  {
    title: 'Keep it confidential',
    text: "What's shared here stays here. Don't repeat anyone's story or name outside the group.",
  },
  {
    title: 'No explicit content',
    text: 'Talk honestly about struggles without graphic detail. Never share sexual content or links to it.',
  },
  {
    title: 'Speak with grace',
    text: 'Encourage, pray and listen. No shaming, lecturing or arguing.',
  },
  {
    title: 'Protect each other',
    text: "Don't pursue anyone romantically or ask for private contact details.",
  },
  {
    title: 'This is not crisis care',
    text: 'If you or someone else is in danger, call or text 988, or call 911.',
  },
  {
    title: 'Moderators keep the group safe',
    text: 'Messages that break these guidelines can be removed, and people can be removed from the group.',
  },
]
