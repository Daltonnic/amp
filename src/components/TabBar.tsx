import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import {
  Bell,
  BookMarked,
  BookOpen,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  House,
  Library,
  Menu,
  MessagesSquare,
  Settings,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { paths } from '@/app/routes'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/dialog'
import { DialogDescription, DialogTitle } from '@radix-ui/react-dialog'
import { useGroupBadge, useIsLeader, useJoinRequestCount } from '@/data/groupQueries'
import { useUnreadNotificationCount } from '@/data/notificationQueries'
import { useLibrary } from '@/data/queries'
import { ModeratorShield } from '@/components/group/Avatar'
import { hapticTap } from '@/lib/native'
import { cn } from '@/lib/utils'

const TABS: { name: string; to: string; icon: LucideIcon }[] = [
  { name: 'Home', to: paths.home, icon: House },
  { name: 'Check-In', to: paths.checkIn, icon: ClipboardCheck },
  { name: 'Grounding', to: paths.grounding, icon: Shield },
  { name: 'Journal', to: paths.journal, icon: BookOpen },
  { name: 'Group', to: paths.group, icon: MessagesSquare },
]

const MORE: { name: string; to: string; icon: LucideIcon }[] = [
  { name: 'Notifications', to: paths.notifications, icon: Bell },
  { name: 'Calendar', to: paths.calendar, icon: CalendarDays },
  { name: 'Resources', to: paths.resources, icon: Library },
  { name: 'Library', to: paths.library, icon: BookMarked },
  { name: 'Trigger Awareness', to: paths.triggers, icon: CircleAlert },
  { name: 'Identity & Scripture', to: paths.identity, icon: Sparkles },
  { name: 'Accountability', to: paths.accountability, icon: Users },
  { name: 'Settings', to: paths.settings, icon: Settings },
]

const tabClass =
  'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors'

export function TabBar() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const library = useLibrary()
  const unread = useGroupBadge()
  const isLeader = useIsLeader()
  const requests = useJoinRequestCount()
  const newNotifications = useUnreadNotificationCount()
  // The Library is admin-published content. Until at least one article is
  // published it stays out of the menu rather than showing an empty section
  // (App Review rejects placeholder content).
  const hasArticles = (library.data?.length ?? 0) > 0
  const more = [
    ...(isLeader ? [{ name: 'Moderators', to: paths.moderators, icon: Shield }] : []),
    ...MORE.filter((m) => m.to !== paths.library || hasArticles),
  ]
  const inMore = more.some((m) => location.pathname.startsWith(m.to))

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-card/85"
    >
      {/* Exactly --tabbar-height tall, so screens that sit above it (the group chat's message bar) line up with it. */}
      <div className="mx-auto flex h-[var(--tabbar-height)] max-w-lg items-stretch justify-around px-1 py-1.5">
        {TABS.map(({ name, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={(e) => {
              hapticTap()
              // Re-tapping the active tab returns to that section's root view.
              if (location.pathname === to) {
                e.preventDefault()
                if (location.search) navigate(to, { replace: true })
                else window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
            className={({ isActive }) =>
              cn(tabClass, isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className="size-5" strokeWidth={isActive ? 2.5 : 1.75} aria-hidden="true" />
                  {to === paths.group && unread > 0 && !isActive && (
                    <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">
                      {unread > 99 ? '99+' : unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </span>
                <span>{name}</span>
              </>
            )}
          </NavLink>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            className={cn(tabClass, inMore ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
            aria-label="More sections"
            onClick={hapticTap}
          >
            <span className="relative">
              <Menu className="size-5" strokeWidth={inMore ? 2.5 : 1.75} aria-hidden="true" />
              {requests > 0 && (
                <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-leader px-1 text-center text-[10px] font-semibold leading-4 text-leader-foreground">
                  {requests}
                  <span className="sr-only"> join requests</span>
                </span>
              )}
            </span>
            <span>More</span>
          </SheetTrigger>
          <SheetContent>
            <DialogTitle className="sr-only">More sections</DialogTitle>
            <DialogDescription className="sr-only">{more.map((m) => m.name).join(', ')}</DialogDescription>
            <ul className="space-y-1 py-2">
              {more.map(({ name, to, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-12 items-center gap-3 rounded-lg px-4 py-3 font-medium transition-colors hover:bg-muted',
                        isActive ? 'bg-primary/5 text-primary' : 'text-foreground',
                      )
                    }
                  >
                    {to === paths.moderators ? (
                      <ModeratorShield className="size-5" />
                    ) : (
                      <Icon className="size-5 text-primary" aria-hidden="true" />
                    )}
                    <span className="flex-1">{name}</span>
                    {to === paths.notifications && newNotifications > 0 && (
                      <span className="rounded-full bg-destructive px-2 text-xs font-semibold leading-5 text-destructive-foreground">
                        {newNotifications > 99 ? '99+' : newNotifications} new
                      </span>
                    )}
                    {to === paths.moderators && requests > 0 && (
                      <span className="rounded-full bg-leader px-2 text-xs font-semibold leading-5 text-leader-foreground">
                        {requests} waiting
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
