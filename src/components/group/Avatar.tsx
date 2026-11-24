import { Crown } from 'lucide-react'
import { avatarColor, avatarInitials } from '@/lib/names'
import { cn } from '@/lib/utils'

/** Initials in a colored circle. The app has no profile photos, on purpose. Leaders get a gold ring. */
export function Avatar({
  userId,
  name,
  leader = false,
  className,
}: {
  userId: string
  name: string
  leader?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold text-white',
        leader && 'ring-2 ring-leader ring-offset-2 ring-offset-background',
        className,
      )}
      style={{ backgroundColor: avatarColor(userId) }}
    >
      {avatarInitials(name)}
    </span>
  )
}

/** The gold "Leader" tag shown next to leaders' names. */
export function LeaderBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded bg-leader px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-leader-foreground',
        className,
      )}
    >
      <Crown className="size-2.5" aria-hidden="true" /> Leader
    </span>
  )
}
