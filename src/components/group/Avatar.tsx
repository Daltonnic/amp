import { avatarColor, avatarInitials } from '@/lib/names'
import { cn } from '@/lib/utils'

/** Initials in a colored circle. The app has no profile photos, on purpose. */
export function Avatar({ userId, name, className }: { userId: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold text-white',
        className,
      )}
      style={{ backgroundColor: avatarColor(userId) }}
    >
      {avatarInitials(name)}
    </span>
  )
}
