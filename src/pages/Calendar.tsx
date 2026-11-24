import { useMemo, useState, type ReactNode } from 'react'
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns'
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Repeat as RepeatIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AboutYouPrompt } from '@/components/AboutYouPrompt'
import { Screen } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label, Skeleton } from '@/components/ui/controls'
import { DialogDescription, DialogTitle, Sheet, SheetContent } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { GROUP_ROOMS } from '@/content/group'
import { occurrenceKey } from '@/data/calendar'
import {
  useCalendarEvent,
  useDeleteEvent,
  useOccurrences,
  useRsvp,
  useRsvpPeople,
  useRsvpSummary,
  useSaveEvent,
} from '@/data/calendarQueries'
import { useIsLeader, useLeaders, useMyRoom } from '@/data/groupQueries'
import { useReadOnVisit } from '@/data/notificationQueries'
import { useProfile } from '@/data/queries'
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarOccurrence,
  GroupRoomId,
  NotificationKind,
  Repeat,
  RsvpResponse,
  RsvpSummary,
} from '@/data/types'
import {
  dayLabel,
  DURATIONS,
  icsFor,
  localTimeZone,
  locationUrl,
  monthGrid,
  REMINDER_PRESETS,
  remindersLabel,
  repeatLabel,
  SUGGESTED_REMINDERS,
  timeRange,
} from '@/lib/calendar'
import { hapticSuccess, hapticTap } from '@/lib/native'
import { cn, errorMessage } from '@/lib/utils'

const ROOM_IDS = Object.keys(GROUP_ROOMS) as GroupRoomId[]

const MEETING_KINDS: NotificationKind[] = ['meeting']

/** Each group's meetings. Leaders see and manage every group's events. */
export default function Calendar() {
  const profile = useProfile()
  const room = useMyRoom()
  const leaders = useLeaders()
  const isLeader = useIsLeader()
  // A meeting reminder links here as ?event=<id>&at=<start in ms> to open that meeting.
  const [params, setParams] = useSearchParams()
  const linkAt = Number(params.get('at'))
  const linkKey = params.get('event') && linkAt > 0 ? `${params.get('event')}|${linkAt}` : null
  const [month, setMonth] = useState(() => startOfMonth(linkAt > 0 ? new Date(linkAt) : new Date()))
  const [selected, setSelected] = useState(() => (linkAt > 0 ? new Date(linkAt) : new Date()))
  const [filter, setFilter] = useState<GroupRoomId | 'all'>('all')
  const [openId, setOpenId] = useState<CalendarOccurrence | null>(null)
  useReadOnVisit(MEETING_KINDS)
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)

  // One fetch covers the visible month grid and the next 60 days.
  const grid = useMemo(() => monthGrid(month), [month])
  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), [])
  const from = grid[0]! < today ? grid[0]! : today
  const lastGridDay = addDays(grid[grid.length - 1]!, 1)
  const soon = addDays(today, 60)
  const to = lastGridDay > soon ? lastGridDay : soon
  const occurrences = useOccurrences(from, to, !leaders.isPending)
  const rsvps = useRsvpSummary(from, to, !leaders.isPending)
  const rsvpFor = (o: CalendarOccurrence) => rsvps.data?.get(occurrenceKey(o.event_id, o.starts_at))

  const visible = useMemo(
    () => (occurrences.data ?? []).filter((o) => filter === 'all' || o.rooms.includes(filter)),
    [occurrences.data, filter],
  )
  const linked = linkKey
    ? ((occurrences.data ?? []).find((o) => occurrenceKey(o.event_id, o.starts_at) === linkKey) ?? null)
    : null
  const shown = openId ?? linked
  const closeLink = () => {
    if (linkKey) setParams({}, { replace: true })
  }
  const onDay = (day: Date) => visible.filter((o) => isSameDay(new Date(o.starts_at), day))
  const upcoming = visible.filter((o) => new Date(o.ends_at) > new Date()).slice(0, 6)

  if (profile.isPending || leaders.isPending) {
    return (
      <Screen className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </Screen>
    )
  }

  if (!room && !isLeader && profile.data) {
    return (
      <Screen className="space-y-4">
        <h1 className="font-display text-xl font-semibold text-foreground">Calendar</h1>
        <AboutYouPrompt
          profileId={profile.data.id}
          title="Which calendar is yours?"
          description="Each group has its own meetings. Are you a man or a woman?"
        />
      </Screen>
    )
  }

  return (
    <Screen className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-foreground">Calendar</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLeader ? 'Meetings for every group' : room ? `Meetings for ${GROUP_ROOMS[room].name}` : ''}
          </p>
        </div>
        {isLeader && (
          <Button
            size="sm"
            className="shrink-0 bg-leader text-leader-foreground hover:bg-leader/90"
            onClick={() => setEditing('new')}
          >
            <Plus aria-hidden="true" /> Add event
          </Button>
        )}
      </header>

      {isLeader && (
        <div
          className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
          role="group"
          aria-label="Show group"
        >
          {(['all', ...ROOM_IDS] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                'min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                filter === id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-foreground',
              )}
            >
              {id === 'all' ? 'All groups' : GROUP_ROOMS[id].name}
            </button>
          ))}
        </div>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonth(subMonths(month, 1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2 className="font-semibold text-foreground" aria-live="polite">
            {format(month, 'MMMM yyyy')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div
          className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground"
          aria-hidden="true"
        >
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label={format(month, 'MMMM yyyy')}>
          {grid.map((day) => {
            const count = onDay(day).length
            const isSel = isSameDay(day, selected)
            const isTodayDay = isSameDay(day, new Date())
            return (
              <button
                key={day.toISOString()}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${format(day, 'EEEE, MMMM d')}${count ? `, ${count} ${count === 1 ? 'event' : 'events'}` : ''}`}
                onClick={() => {
                  hapticTap()
                  setSelected(day)
                  if (!isSameMonth(day, month)) setMonth(startOfMonth(day))
                }}
                className={cn(
                  'mx-auto flex size-10 flex-col items-center justify-center rounded-full text-sm transition-colors',
                  !isSameMonth(day, month) && 'text-muted-foreground/50',
                  isSel ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
                  !isSel && isTodayDay && 'font-semibold text-primary ring-1 ring-primary/40',
                )}
              >
                {format(day, 'd')}
                <span
                  className={cn(
                    'mt-0.5 size-1 rounded-full',
                    count ? (isSel ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent',
                  )}
                />
              </button>
            )
          })}
        </div>
      </Card>

      <section className="space-y-2" aria-labelledby="day-heading">
        <h2 id="day-heading" className="text-sm font-semibold text-foreground">
          {isSameDay(selected, new Date()) ? 'Today' : format(selected, 'EEEE, MMMM d')}
        </h2>
        {occurrences.isPending ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : onDay(selected).length === 0 ? (
          <p className="text-sm text-muted-foreground">No meetings this day.</p>
        ) : (
          <ul className="space-y-2">
            {onDay(selected).map((o) => (
              <li key={`${o.event_id}-${o.starts_at}`}>
                <OccurrenceRow
                  occurrence={o}
                  rsvp={rsvpFor(o)}
                  showRooms={isLeader}
                  onOpen={() => setOpenId(o)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-sm font-semibold text-foreground">
          Coming up
        </h2>
        {occurrences.isError ? (
          <p className="text-sm text-muted-foreground">Couldn’t load the calendar. Check your connection.</p>
        ) : upcoming.length === 0 && !occurrences.isPending ? (
          <Card className="p-5 text-center text-sm text-muted-foreground">
            {isLeader ? 'No meetings yet. Tap “Add event” to add one.' : 'No meetings scheduled yet.'}
          </Card>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((o) => (
              <li key={`${o.event_id}-${o.starts_at}`}>
                <OccurrenceRow
                  occurrence={o}
                  rsvp={rsvpFor(o)}
                  showDay
                  showRooms={isLeader}
                  onOpen={() => setOpenId(o)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <EventSheet
        occurrence={shown}
        rsvp={shown ? rsvpFor(shown) : undefined}
        isLeader={isLeader}
        onClose={() => {
          setOpenId(null)
          closeLink()
        }}
        onEdit={(event) => {
          setOpenId(null)
          closeLink()
          setEditing(event)
        }}
      />
      {editing && (
        <EventForm
          event={editing === 'new' ? null : editing}
          defaultRooms={room ? [room] : []}
          defaultDate={selected}
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  )
}

function OccurrenceRow({
  occurrence: o,
  rsvp,
  showDay = false,
  showRooms = false,
  onOpen,
}: {
  occurrence: CalendarOccurrence
  rsvp?: RsvpSummary
  showDay?: boolean
  showRooms?: boolean
  onOpen: () => void
}) {
  const start = new Date(o.starts_at)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-stretch gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/30"
    >
      <span className="w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate font-semibold text-foreground">{o.title}</span>
          {rsvp?.mine === 'yes' && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Check className="size-3" aria-hidden="true" /> Going
            </span>
          )}
          {rsvp?.mine === 'no' && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Can’t make it
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {showDay && `${dayLabel(start)} · `}
          {timeRange(o)}
          {o.location && ` · ${o.location}`}
          {rsvp && rsvp.going > 0 && ` · ${rsvp.going} going`}
        </span>
        {showRooms && (
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
            {o.rooms.length === 4 ? 'All groups' : o.rooms.map((r) => GROUP_ROOMS[r].name).join(', ')}
          </span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 text-primary [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
    </div>
  )
}

function EventSheet({
  occurrence: o,
  rsvp,
  isLeader,
  onClose,
  onEdit,
}: {
  occurrence: CalendarOccurrence | null
  rsvp?: RsvpSummary
  isLeader: boolean
  onClose: () => void
  onEdit: (event: CalendarEvent) => void
}) {
  const event = useCalendarEvent(isLeader && o ? o.event_id : null)
  const del = useDeleteEvent()
  const [confirm, setConfirm] = useState(false)
  if (!o) return <Sheet open={false} />
  const start = new Date(o.starts_at)
  const url = locationUrl(o.location)

  const addToCalendar = () => {
    const blob = new Blob([icsFor(o)], { type: 'text/calendar' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${o.title.replace(/[^\w\s-]/g, '').trim() || 'event'}.ics`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          setConfirm(false)
          onClose()
        }
      }}
    >
      <SheetContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="px-1 pt-1 font-display text-xl font-semibold">{o.title}</DialogTitle>
        <DialogDescription className="sr-only">Meeting details</DialogDescription>
        <div className="space-y-3 px-1 py-4">
          <Detail icon={<CalendarDays />}>{format(start, 'EEEE, MMMM d, yyyy')}</Detail>
          <Detail icon={<Clock />}>{timeRange(o)}</Detail>
          {o.repeat !== 'none' && (
            <Detail icon={<RepeatIcon />}>{repeatLabel(o.repeat, o.starts_local, o.repeat_until)}</Detail>
          )}
          {o.location && (
            <Detail icon={<MapPin />}>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-medium text-primary underline"
                >
                  {url}
                </a>
              ) : (
                o.location
              )}
            </Detail>
          )}
          <Detail icon={<Bell />}>Reminders: {remindersLabel(o.reminders).toLowerCase()}</Detail>
          {isLeader && (
            <Detail icon={<Users />}>
              {o.rooms.length === 4 ? 'All groups' : o.rooms.map((r) => GROUP_ROOMS[r].name).join(', ')}
            </Detail>
          )}
          {o.description && (
            <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm text-foreground">
              {o.description}
            </p>
          )}
        </div>

        {confirm ? (
          <div className="space-y-3 pb-2">
            <p className="text-sm text-foreground">
              Delete “{o.title}”{o.repeat !== 'none' ? ' and all its repeats' : ''}? Everyone will stop seeing
              it.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={del.isPending}
                onClick={() =>
                  del.mutate(o.event_id, {
                    onSuccess: () => {
                      toast.success('Event deleted.')
                      setConfirm(false)
                      onClose()
                    },
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            <RsvpBox occurrence={o} rsvp={rsvp} isLeader={isLeader} />
            <Button variant="outline" className="w-full" onClick={addToCalendar}>
              <CalendarPlus aria-hidden="true" /> Add to my calendar
            </Button>
            {isLeader && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-leader/50 text-leader"
                  disabled={!event.data}
                  onClick={() => event.data && onEdit(event.data)}
                >
                  <Pencil aria-hidden="true" /> Edit
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive"
                  onClick={() => setConfirm(true)}
                >
                  <Trash2 aria-hidden="true" /> Delete
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Leaders: add or edit an event. */
function EventForm({
  event,
  defaultRooms,
  defaultDate,
  onClose,
}: {
  event: CalendarEvent | null
  defaultRooms: GroupRoomId[]
  defaultDate: Date
  onClose: () => void
}) {
  const save = useSaveEvent()
  const start = event ? parseISO(event.starts_local) : null
  const [title, setTitle] = useState(event?.title ?? '')
  const [rooms, setRooms] = useState<GroupRoomId[]>(event?.rooms ?? defaultRooms)
  const [date, setDate] = useState(
    format(
      start ?? (defaultDate < new Date(new Date().setHours(0, 0, 0, 0)) ? new Date() : defaultDate),
      'yyyy-MM-dd',
    ),
  )
  const [time, setTime] = useState(start ? format(start, 'HH:mm') : '19:00')
  const [duration, setDuration] = useState(event?.duration_minutes ?? 60)
  const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? 'none')
  const [until, setUntil] = useState(event?.repeat_until ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [reminders, setReminders] = useState<number[]>(event?.reminders ?? SUGGESTED_REMINDERS)
  const timezone = event?.timezone ?? localTimeZone()

  const startsLocal = `${date}T${time}:00`
  const valid = title.trim() && rooms.length > 0 && date && time && (!until || until >= date)
  const toggleRoom = (id: GroupRoomId) =>
    setRooms(rooms.includes(id) ? rooms.filter((r) => r !== id) : [...rooms, id])
  const toggleReminder = (m: number) =>
    setReminders(reminders.includes(m) ? reminders.filter((r) => r !== m) : [...reminders, m])

  const submit = () => {
    if (!valid) return
    const input: CalendarEventInput = {
      title: title.trim(),
      rooms,
      starts_local: startsLocal,
      timezone,
      duration_minutes: duration,
      repeat,
      repeat_until: repeat !== 'none' && until ? until : null,
      location: location.trim(),
      description: description.trim(),
      reminders: [...reminders].sort((a, b) => b - a),
    }
    save.mutate(
      { id: event?.id ?? null, input },
      {
        onSuccess: () => {
          hapticSuccess()
          toast.success(event ? 'Event updated.' : 'Event added to the calendar.')
          onClose()
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )
  }

  const startDate = parseISO(startsLocal)
  const repeatChoices: { value: Repeat; label: string }[] = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: `Every week on ${format(startDate, 'EEEE')}` },
    { value: 'biweekly', label: `Every 2 weeks on ${format(startDate, 'EEEE')}` },
    { value: 'monthly', label: `Every month on day ${format(startDate, 'd')}` },
  ]

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-h-[92dvh] overflow-y-auto">
        <DialogTitle className="px-1 pt-1 font-display text-lg font-semibold">
          {event ? 'Edit event' : 'Add an event'}
        </DialogTitle>
        <DialogDescription className="px-1 text-sm text-muted-foreground">
          Only leaders can add events. Everyone in the groups you pick will see it.
        </DialogDescription>
        <form
          className="space-y-5 px-1 py-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Tuesday Night Group"
              required
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Groups</legend>
            <div className="flex flex-wrap gap-2">
              {ROOM_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={rooms.includes(id)}
                  onClick={() => toggleRoom(id)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-xs font-medium transition-colors',
                    rooms.includes(id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card text-foreground',
                  )}
                >
                  {GROUP_ROOMS[id].name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRooms(rooms.length === 4 ? [] : ROOM_IDS)}
                className="min-h-9 rounded-full px-3 text-xs font-medium text-primary underline"
              >
                {rooms.length === 4 ? 'Clear' : 'All groups'}
              </button>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-time">Starts at</Label>
              <Input
                id="ev-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-duration">How long</Label>
              <select
                id="ev-duration"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {DURATIONS.map((d) => (
                  <option key={d.minutes} value={d.minutes}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-repeat">How often</Label>
              <select
                id="ev-repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as Repeat)}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {repeatChoices.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {repeat !== 'none' && (
            <div className="space-y-1.5">
              <Label htmlFor="ev-until">Repeat until (optional)</Label>
              <Input
                id="ev-until"
                type="date"
                value={until}
                min={date}
                onChange={(e) => setUntil(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ev-location">Where (optional)</Label>
            <Input
              id="ev-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={300}
              placeholder="An address, room, or https:// video link"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-details">Details (optional)</Label>
            <Textarea
              id="ev-details"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              className="min-h-20 resize-none"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Reminders</legend>
            <p className="-mt-1 text-xs text-muted-foreground">
              A notification goes out at each time you pick, before every meeting.
            </p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  type="button"
                  aria-pressed={reminders.includes(p.minutes)}
                  onClick={() => toggleReminder(p.minutes)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-xs font-medium transition-colors',
                    reminders.includes(p.minutes)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <button
                type="button"
                className="min-h-8 font-medium text-primary underline"
                onClick={() => setReminders(SUGGESTED_REMINDERS)}
              >
                Use suggested (1 day and 1 hour before)
              </button>
              <button
                type="button"
                className="min-h-8 font-medium text-primary underline"
                onClick={() => setReminders([1440, 60, 15])}
              >
                1 day, 1 hour and 15 minutes before
              </button>
              <button
                type="button"
                className="min-h-8 text-muted-foreground underline"
                onClick={() => setReminders([])}
              >
                No reminders
              </button>
            </div>
          </fieldset>

          <p className="text-xs text-muted-foreground">
            Times are in your time zone ({timezone.replace(/_/g, ' ')}). Everyone sees them in their own time
            zone.
          </p>

          <div className="flex gap-2 pb-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={!valid || save.isPending}>
              {save.isPending ? 'Saving…' : event ? 'Save changes' : 'Add event'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/** Going / Can't make it for this date, with the count (and names, for leaders). */
function RsvpBox({
  occurrence: o,
  rsvp,
  isLeader,
}: {
  occurrence: CalendarOccurrence
  rsvp?: RsvpSummary
  isLeader: boolean
}) {
  const answer = useRsvp()
  const people = useRsvpPeople(o.event_id, o.starts_at, isLeader)
  const mine = rsvp?.mine ?? null
  const going = rsvp?.going ?? 0
  const ended = new Date(o.ends_at) < new Date()

  const choose = (response: RsvpResponse) =>
    answer.mutate(
      { eventId: o.event_id, start: o.starts_at, response: mine === response ? null : response },
      {
        onSuccess: () => hapticTap(),
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  const yes = (people.data ?? []).filter((p) => p.response === 'yes')
  const no = (people.data ?? []).filter((p) => p.response === 'no')

  return (
    <div className="space-y-3 rounded-xl border p-3" role="group" aria-label="RSVP">
      {!ended && (
        <>
          <p className="text-sm font-medium text-foreground">Are you coming?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mine === 'yes' ? 'default' : 'outline'}
              aria-pressed={mine === 'yes'}
              onClick={() => choose('yes')}
            >
              <Check aria-hidden="true" /> Going
            </Button>
            <Button
              variant={mine === 'no' ? 'secondary' : 'outline'}
              aria-pressed={mine === 'no'}
              onClick={() => choose('no')}
            >
              <X aria-hidden="true" /> Can’t make it
            </Button>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {going === 0
          ? ended
            ? 'No one said they were going.'
            : 'No one has said they’re going yet.'
          : `${going} ${ended ? (going === 1 ? 'person said they were' : 'people said they were') : ''}${ended ? ' going' : 'going'}`}
        {!ended && mine === 'no' && ' · You won’t get reminders for this date.'}
      </p>
      {isLeader && (yes.length > 0 || no.length > 0) && (
        <div className="space-y-1 border-t pt-2 text-xs">
          {yes.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">Going ({yes.length}): </span>
              <span className="text-muted-foreground">{yes.map((p) => p.shown_name).join(', ')}</span>
            </p>
          )}
          {no.length > 0 && (
            <p>
              <span className="font-semibold text-foreground">Can’t make it ({no.length}): </span>
              <span className="text-muted-foreground">{no.map((p) => p.shown_name).join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
