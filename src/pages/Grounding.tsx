import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { BookOpen, ChevronRight, Eye, Hand, Heart, Sparkles, Wind, X, type LucideIcon } from 'lucide-react'
import { paths } from '@/app/routes'
import { Screen, useBack } from '@/components/layout'
import { StepProgress } from '@/components/inputs'
import { Button } from '@/components/ui/button'
import { Card, TapCard } from '@/components/ui/card'
import {
  BODY_STEPS,
  BREATHING_PHASES,
  GROUNDING_SCRIPTURES,
  ORIENTING_STEPS,
  PRAYERS,
  REASSURANCES,
  TRUTHS,
  type GuidedStep,
} from '@/content/grounding'
import { useLogGroundingSession, useTrack } from '@/data/queries'
import type { GroundingType, Track } from '@/data/types'
import { dailyPick } from '@/lib/dates'
import { hapticTap } from '@/lib/native'

type ToolId = 'breathing' | 'body' | 'orienting' | 'prayer' | 'truth' | 'scripture' | 'reassurance'

const TOOLS: {
  id: ToolId
  label: string
  icon: LucideIcon
  description: string
  log: GroundingType
  spouseOnly?: boolean
}[] = [
  {
    id: 'breathing',
    label: 'Slow Breathing',
    icon: Wind,
    description: 'Calm your nervous system',
    log: 'breathing',
  },
  {
    id: 'body',
    label: 'Body Grounding',
    icon: Hand,
    description: 'Get present in your body',
    log: 'body_grounding',
  },
  {
    id: 'orienting',
    label: '5-4-3-2-1 Exercise',
    icon: Eye,
    description: 'Anchor to your surroundings',
    log: 'orienting',
  },
  { id: 'prayer', label: 'Guided Prayer', icon: BookOpen, description: 'Bring it to God', log: 'prayer' },
  {
    id: 'truth',
    label: 'Truth Reminders',
    icon: Sparkles,
    description: 'Remember who you are',
    log: 'truth_reminder',
  },
  {
    id: 'scripture',
    label: 'Scripture Reading',
    icon: BookOpen,
    description: "Rest in God's word",
    log: 'scripture',
  },
  {
    id: 'reassurance',
    label: 'Reassurance',
    icon: Heart,
    description: 'Words of safety and truth',
    log: 'reassurance',
    spouseOnly: true,
  },
]

export default function Grounding() {
  const [params, setParams] = useSearchParams()
  const track = useTrack()
  const back = useBack(paths.grounding)
  const logSession = useLogGroundingSession()

  const tools = TOOLS.filter((t) => !t.spouseOnly || track === 'spouse')
  const active = tools.find((t) => t.id === params.get('tool'))

  const close = () => {
    if (active) logSession.mutate(active.log)
    back()
  }

  if (active) {
    return (
      <Screen>
        <div className="animate-in fade-in duration-300">
          <ActiveTool id={active.id} track={track} onClose={close} />
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <h1 className="mb-1 font-display text-xl font-semibold text-foreground">Grounding Tools</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {track === 'spouse' ? 'Find your footing. Take it slow.' : 'Pause. Breathe. Get grounded.'}
      </p>
      <div className="space-y-3">
        {tools.map(({ id, label, icon: Icon, description }) => (
          <TapCard
            key={id}
            className="flex min-h-16 items-center gap-4 p-4"
            onClick={() => setParams({ tool: id })}
          >
            <span className="rounded-xl bg-primary/10 p-2.5">
              <Icon className="size-5 text-primary" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block text-xs text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </TapCard>
        ))}
      </div>
    </Screen>
  )
}

function ActiveTool({ id, track, onClose }: { id: ToolId; track: Track; onClose: () => void }) {
  switch (id) {
    case 'breathing':
      return <Breathing onClose={onClose} />
    case 'body':
      return <GuidedSteps title="Body Grounding" steps={BODY_STEPS} onClose={onClose} />
    case 'orienting':
      return <GuidedSteps title="5-4-3-2-1 Grounding" steps={ORIENTING_STEPS} onClose={onClose} />
    case 'prayer':
      return <Prayer track={track} onClose={onClose} />
    case 'truth':
      return (
        <Rotator
          title="Truth Reminders"
          items={TRUTHS[track]}
          nextLabel="Another"
          onClose={onClose}
          closeLabel="Close truth reminders"
        />
      )
    case 'scripture':
      return <Scripture track={track} onClose={onClose} />
    case 'reassurance':
      return (
        <Rotator
          title="Reassurance"
          items={REASSURANCES}
          nextLabel="Another"
          onClose={onClose}
          closeLabel="Close reassurance"
          tone="accent"
        />
      )
  }
}

function CloseButton({
  onClick,
  label,
  align = 'start',
}: {
  onClick: () => void
  label: string
  align?: 'start' | 'end'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`mb-4 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${align === 'end' ? '-mr-2 self-end' : '-ml-2'}`}
    >
      <X className="size-5" aria-hidden="true" />
    </button>
  )
}

function Breathing({ onClose }: { onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState(0)
  const [cycle, setCycle] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const current = BREATHING_PHASES[phase]!

  useEffect(() => {
    if (!running) return
    hapticTap()
    timer.current = setTimeout(() => {
      const next = (phase + 1) % BREATHING_PHASES.length
      setPhase(next)
      if (next === 0) setCycle((c) => c + 1)
    }, current.duration)
    return () => clearTimeout(timer.current)
  }, [running, phase, current.duration])

  // Expand while breathing in, hold large, contract while breathing out.
  const expanded = phase === 0 || phase === 1
  const transitionMs = phase === 0 || phase === 2 ? current.duration : 300

  return (
    <div className="flex flex-col items-center py-4">
      <CloseButton onClick={onClose} label="Close breathing exercise" align="end" />
      {running ? (
        <div className="space-y-10 text-center">
          <div className="flex h-56 items-center justify-center">
            <div
              className="flex size-32 items-center justify-center rounded-full bg-primary/20 ease-in-out"
              style={{
                transform: `scale(${expanded ? 1.5 : 1})`,
                opacity: expanded ? 1 : 0.7,
                transitionProperty: 'transform, opacity',
                transitionDuration: `${transitionMs}ms`,
              }}
            >
              <div className="size-16 rounded-full bg-primary/40" />
            </div>
          </div>
          <div aria-live="polite">
            <h2 className="font-display text-xl font-semibold text-foreground">{current.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{current.instruction}</p>
          </div>
          <p className="text-xs text-muted-foreground">Cycle {cycle + 1}</p>
          <Button
            variant="outline"
            onClick={() => {
              setRunning(false)
              setPhase(0)
              clearTimeout(timer.current)
            }}
          >
            End Session
          </Button>
        </div>
      ) : (
        <div className="space-y-6 text-center">
          <h2 className="font-display text-lg font-semibold text-foreground">Slow Breathing</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            This exercise helps calm your nervous system. Find a comfortable position and breathe with the
            guide.
          </p>
          <Button size="lg" onClick={() => setRunning(true)}>
            Begin
          </Button>
        </div>
      )}
    </div>
  )
}

function GuidedSteps({ title, steps, onClose }: { title: string; steps: GuidedStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const step = steps[index]!
  const last = index === steps.length - 1
  return (
    <div className="py-2">
      <CloseButton onClick={onClose} label={`Close ${title}`} />
      <h2 className="mb-2 font-display text-lg font-semibold text-foreground">{title}</h2>
      <StepProgress total={steps.length} current={index} className="mb-6 gap-1" />
      <Card key={index} className="animate-step-in space-y-3 p-6 text-center" aria-live="polite">
        <p className="font-display text-xl font-semibold text-foreground">{step.instruction}</p>
        <p className="text-sm text-muted-foreground">{step.detail}</p>
      </Card>
      <div className="mt-6 flex gap-3">
        {index > 0 && (
          <Button variant="outline" onClick={() => setIndex(index - 1)} className="flex-1">
            Back
          </Button>
        )}
        {last ? (
          <Button onClick={onClose} className="flex-1">
            Done
          </Button>
        ) : (
          <Button onClick={() => setIndex(index + 1)} className="flex-1">
            Next <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

function Prayer({ track, onClose }: { track: Track; onClose: () => void }) {
  const prayer = dailyPick(PRAYERS[track], new Date().getDate())
  return (
    <div className="py-2">
      <CloseButton onClick={onClose} label="Close guided prayer" />
      <h2 className="mb-2 font-display text-lg font-semibold text-foreground">{prayer.title}</h2>
      <Card className="border-primary/10 bg-primary/5 p-6">
        <p className="text-sm italic leading-relaxed text-foreground">{prayer.text}</p>
      </Card>
      <Button variant="outline" onClick={onClose} className="mt-6 w-full">
        Amen
      </Button>
    </div>
  )
}

function Scripture({ track, onClose }: { track: Track; onClose: () => void }) {
  const passages = GROUNDING_SCRIPTURES[track]
  const [index, setIndex] = useState(0)
  const passage = passages[index]!
  return (
    <div className="py-2">
      <CloseButton onClick={onClose} label="Close scripture reading" />
      <h2 className="mb-2 font-display text-lg font-semibold text-foreground">{passage.ref}</h2>
      <Card key={index} className="animate-step-in border-primary/10 bg-primary/5 p-6" aria-live="polite">
        <p className="italic leading-relaxed text-foreground">{passage.text}</p>
      </Card>
      <p className="mt-4 text-center text-sm text-muted-foreground">Sit with these words. Let them settle.</p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => setIndex((index + 1) % passages.length)} className="flex-1">
          Another passage
        </Button>
        <Button onClick={onClose} className="flex-1">
          Done
        </Button>
      </div>
    </div>
  )
}

function Rotator({
  title,
  items,
  nextLabel,
  onClose,
  closeLabel,
  tone = 'primary',
}: {
  title: string
  items: string[]
  nextLabel: ReactNode
  onClose: () => void
  closeLabel: string
  tone?: 'primary' | 'accent'
}) {
  const [index, setIndex] = useState(0)
  return (
    <div className="py-2">
      <CloseButton onClick={onClose} label={closeLabel} />
      <h2 className="mb-6 font-display text-lg font-semibold text-foreground">{title}</h2>
      <Card
        key={index}
        aria-live="polite"
        className={`flex min-h-[140px] animate-step-in items-center justify-center p-8 text-center ${tone === 'accent' ? 'border-accent bg-accent/40' : 'border-primary/10 bg-primary/5'}`}
      >
        <p className="font-display text-lg leading-relaxed text-foreground">{items[index]}</p>
      </Card>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => setIndex((index + 1) % items.length)} className="flex-1">
          {nextLabel} <ChevronRight aria-hidden="true" />
        </Button>
        <Button onClick={onClose} className="flex-1">
          Done
        </Button>
      </div>
    </div>
  )
}
