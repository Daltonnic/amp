import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { format } from 'date-fns'
import { Plus, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { paths } from '@/app/routes'
import { ChipGroup, IntensitySlider } from '@/components/inputs'
import { EmptyState, PageHeader, Screen, useBack } from '@/components/layout'
import { PullToRefresh } from '@/components/PullToRefresh'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, Skeleton } from '@/components/ui/controls'
import { Textarea } from '@/components/ui/input'
import { RESPONSE_PATTERNS, TRIGGER_EMOTIONS, TRIGGER_TYPES } from '@/content/triggers'
import { useCreateTriggerLog, useTriggerLogs } from '@/data/queries'
import type { ResponsePattern, TriggerLog, TriggerLogInput, TriggerType } from '@/data/types'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

const EMPTY: TriggerLogInput = {
  emotional_state: '',
  event_description: '',
  thoughts: '',
  trigger_type: '' as TriggerType,
  physical_sensations: '',
  response_pattern: '',
  healthy_next_step: '',
  intensity: 5,
}

const typeLabel = (t: string) => TRIGGER_TYPES.find((x) => x.value === t)?.label ?? t

export default function TriggerAwareness() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'list'
  const logs = useTriggerLogs()
  const navigate = useNavigate()

  if (view === 'new')
    return (
      <NewLog onSaved={(log) => setParams({ view: 'grounding-prompt', logId: log.id }, { replace: true })} />
    )

  if (view === 'grounding-prompt') {
    return (
      <Screen>
        <PageHeader title="Trigger Logged" onBack={() => setParams({}, { replace: true })} />
        <Card className="space-y-4 p-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Good. You named it.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Would you like to use a grounding tool right now?
            </p>
          </div>
          <Button className="w-full" onClick={() => navigate(paths.grounding)}>
            <ShieldCheck aria-hidden="true" /> Open Grounding Tools
          </Button>
          <button
            type="button"
            onClick={() => setParams({}, { replace: true })}
            className="min-h-11 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Not right now
          </button>
        </Card>
      </Screen>
    )
  }

  const entries = logs.data ?? []
  return (
    <>
      <PullToRefresh onRefresh={() => logs.refetch()}>
        <Screen>
          <PageHeader
            title="Trigger Awareness"
            subtitle="Map your patterns. Build clarity."
            action={
              <Button size="sm" onClick={() => setParams({ view: 'new' })}>
                <Plus aria-hidden="true" /> Log
              </Button>
            }
          />
          {logs.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState>No triggers logged yet. Awareness starts with naming.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {entries.map((log) => (
                <li key={log.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="secondary">{typeLabel(log.trigger_type)}</Badge>
                          <span className="text-xs text-muted-foreground">Intensity: {log.intensity}/10</span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{log.emotional_state}</p>
                        {log.event_description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {log.event_description}
                          </p>
                        )}
                      </div>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d')}
                      </span>
                    </div>
                    <Link
                      to={paths.grounding}
                      className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-primary transition-colors hover:bg-primary/5"
                    >
                      <ShieldCheck className="size-3.5" aria-hidden="true" /> Ground through this
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Screen>
      </PullToRefresh>
    </>
  )
}

function NewLog({ onSaved }: { onSaved: (log: TriggerLog) => void }) {
  const back = useBack(paths.triggers)
  const create = useCreateTriggerLog()
  const [form, setForm] = useState<TriggerLogInput>(EMPTY)
  const set = <K extends keyof TriggerLogInput>(key: K, value: TriggerLogInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    try {
      const log = await create.mutateAsync(form)
      hapticSuccess()
      onSaved(log)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const text = (
    key: 'event_description' | 'thoughts' | 'physical_sensations' | 'healthy_next_step',
    label: string,
    placeholder: string,
  ) => (
    <div className="space-y-2">
      <label htmlFor={`t-${key}`} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Textarea
        id={`t-${key}`}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        maxLength={10000}
        className="resize-none"
      />
    </div>
  )

  return (
    <Screen className="space-y-6">
      <PageHeader
        title="Log a Trigger"
        subtitle="Awareness is the first step. Name what happened."
        onBack={back}
      />
      <ChipGroup
        label="What were you feeling?"
        options={TRIGGER_EMOTIONS}
        value={form.emotional_state}
        onChange={(v) => set('emotional_state', v)}
      />
      <ChipGroup
        label="Type of trigger"
        options={TRIGGER_TYPES.map((t) => t.value)}
        value={form.trigger_type}
        onChange={(v) => set('trigger_type', v)}
        getLabel={typeLabel}
      />
      <IntensitySlider label="Intensity" value={form.intensity} onChange={(v) => set('intensity', v)} />
      {text('event_description', 'What happened?', 'Describe the event or situation...')}
      {text('thoughts', 'What were you thinking?', 'What thoughts ran through your mind?')}
      {text('physical_sensations', 'Physical sensations', 'What did you notice in your body?')}
      <ChipGroup
        label="How did you respond?"
        options={RESPONSE_PATTERNS.map((r) => r.value)}
        value={form.response_pattern}
        onChange={(v) => set('response_pattern', v as ResponsePattern)}
        getLabel={(v) => RESPONSE_PATTERNS.find((r) => r.value === v)?.label ?? v}
      />
      {text('healthy_next_step', 'A healthier next step', 'What could I do differently next time?')}
      <Button
        onClick={() => void save()}
        disabled={!form.emotional_state || !form.trigger_type || create.isPending}
        className="w-full"
      >
        <Save aria-hidden="true" /> {create.isPending ? 'Saving...' : 'Save Log'}
      </Button>
    </Screen>
  )
}
