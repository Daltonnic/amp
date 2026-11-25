import { Shield } from 'lucide-react'
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

/** The yellow shield that marks moderators (called leaders in the code and database). */
export function ModeratorShield({ className }: { className?: string }) {
  return (
    <Shield
      className={cn('size-4 fill-moderator-shield text-leader', className)}
      strokeWidth={2}
      aria-hidden="true"
    />
  )
}

/** The "Moderator" tag shown next to moderators' names. */
export function LeaderBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-leader/30 bg-leader-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-leader',
        className,
      )}
    >
      <ModeratorShield className="size-3" /> Moderator
    </span>
  )
}
