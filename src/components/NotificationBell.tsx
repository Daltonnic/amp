import { Bell } from 'lucide-react'
import { Link } from 'react-router'
import { paths } from '@/app/routes'
import { useUnreadNotificationCount } from '@/data/notificationQueries'
import { hapticTap } from '@/lib/native'

/** Top-right bell on Home, with how many notifications are new. */
export function NotificationBell() {
  const count = useUnreadNotificationCount()
  return (
    <Link
      to={paths.notifications}
      onClick={hapticTap}
      aria-label={count ? `Notifications, ${count} new` : 'Notifications'}
      // The invisible ::after keeps a comfortable tap area around the small button.
      className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-card/90 text-foreground shadow-xs transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-primary/5 active:scale-[0.97]"
    >
      <Bell className="size-4" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground ring-2 ring-background">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
