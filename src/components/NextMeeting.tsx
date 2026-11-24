import { Link } from 'react-router'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { paths } from '@/app/routes'
import { useNextMeeting } from '@/data/calendarQueries'
import { dayLabel, timeRange } from '@/lib/calendar'

/** Home: the next meeting in your group, one tap from the calendar. Hidden when nothing is scheduled. */
export function NextMeeting() {
  const next = useNextMeeting()
  const o = next.data
  if (!o) return null
  const start = new Date(o.starts_at)
  return (
    <Link
      to={paths.calendar}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30"
    >
      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-primary">Next meeting</span>
        <span className="block truncate font-semibold text-foreground">{o.title}</span>
        <span className="block text-xs text-muted-foreground">
          {dayLabel(start)} · {timeRange(o)}
        </span>
      </span>
      <span className="flex shrink-0 items-center text-xs font-medium text-primary">
        Calendar <ChevronRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  )
}
