import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { paths } from '@/app/routes'
import { Chip, IntensitySlider, OptionCard, StepProgress } from '@/components/inputs'
import { Screen } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { BODY_AREAS, CURRENT_NEEDS, EMOTIONS, SPIRITUAL_CONDITIONS } from '@/content/checkIn'
import { useCreateCheckIn, useTrack } from '@/data/queries'
import type { CheckInInput, Track } from '@/data/types'
import { localDate } from '@/lib/dates'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

const STEPS: Record<Track, { id: string; label: string }[]> = {
  men: [
    { id: 'emotion', label: 'Emotions' },
    { id: 'levels', label: 'Awareness' },
    { id: 'triggers', label: 'Triggers' },
    { id: 'spiritual', label: 'Spiritual' },
    { id: 'honesty', label: 'Honesty' },
    { id: 'next', label: 'Next Step' },
  ],
  spouse: [
    { id: 'emotion', label: 'Emotions' },
    { id: 'intensity', label: 'Intensity' },
    { id: 'body', label: 'Body' },
    { id: 'fear', label: 'Fear' },
    { id: 'need', label: 'Needs' },
    { id: 'reflection', label: 'Reflection' },
  ],
}

type Draft = Omit<CheckInInput, 'track' | 'date'>

const EMPTY: Draft = {
  emotions: [],
  custom_emotion: '',
  intensity: 5,
  temptation_level: 3,
  stress_level: 5,
  recent_triggers: '',
  spiritual_condition: '',
  honesty_check: '',
  next_step: '',
  body_awareness: '',
  primary_fear: '',
  current_need: '',
  reflection: '',
}

export default function CheckIn() {
  const navigate = useNavigate()
  const track = useTrack()
  const create = useCreateCheckIn()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const steps = STEPS[track]
  const isMen = track === 'men'
  const hasEmotion = draft.emotions.length > 0 || Boolean(draft.custom_emotion.trim())
  const toggleEmotion = (emotion: string) =>
    set(
      'emotions',
      draft.emotions.includes(emotion)
        ? draft.emotions.filter((e) => e !== emotion)
        : [...draft.emotions, emotion],
    )

  const goTo = (next: number) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  const complete = async () => {
    try {
      await create.mutateAsync({
        ...draft,
        custom_emotion: draft.custom_emotion.trim(),
        track,
        date: localDate(),
        // Only keep the scales this track was actually asked about.
        intensity: isMen ? null : draft.intensity,
        temptation_level: isMen ? draft.temptation_level : null,
        stress_level: isMen ? draft.stress_level : null,
      })
      hapticSuccess()
      toast.success('Check-in saved. Well done for pausing.')
      navigate(paths.home)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const textStep = (
    label: string,
    hint: string | null,
    key: keyof Draft,
    placeholder: string,
    minH = 'min-h-[120px]',
  ) => (
    <div className="space-y-3">
      <label htmlFor={`f-${key}`} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Textarea
        id={`f-${key}`}
        placeholder={placeholder}
        value={draft[key] as string}
        onChange={(e) => set(key, e.target.value as never)}
        maxLength={10000}
        className={`${minH} resize-none`}
      />
    </div>
  )

  const choiceCards = (label: string, options: string[], key: 'spiritual_condition' | 'current_need') => (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-medium text-foreground">{label}</legend>
      <div className="space-y-2">
        {options.map((option) => (
          <OptionCard
            key={option}
            selected={draft[key] === option}
            onClick={() => set(key, option)}
            className="p-3.5"
          >
            <span className="font-medium capitalize text-foreground">{option}</span>
          </OptionCard>
        ))}
      </div>
    </fieldset>
  )

  const emotionStep = (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          {track === 'spouse' ? 'What are you feeling right now?' : 'How are you today?'}
        </legend>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">Choose as many as fit.</p>
        <div className="flex flex-wrap gap-2">
          {EMOTIONS[track].map((emotion) => (
            <Chip
              key={emotion}
              selected={draft.emotions.includes(emotion)}
              onClick={() => toggleEmotion(emotion)}
            >
              {emotion}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Input
        aria-label="Describe how you feel in your own words"
        placeholder="Or describe in your own words..."
        value={draft.custom_emotion}
        onChange={(e) => set('custom_emotion', e.target.value)}
        maxLength={200}
        className="mt-2"
      />
    </div>
  )

  const renderStep = () => {
    const id = steps[step]!.id
    switch (id) {
      case 'emotion':
        return emotionStep
      case 'levels':
        return (
          <div className="space-y-6">
            <IntensitySlider
              label="Temptation level"
              value={draft.temptation_level ?? 3}
              onChange={(v) => set('temptation_level', v)}
              lowLabel="None"
              highLabel="Intense"
            />
            <IntensitySlider
              label="Stress level"
              value={draft.stress_level ?? 5}
              onChange={(v) => set('stress_level', v)}
            />
          </div>
        )
      case 'triggers':
        return textStep(
          'Any recent triggers?',
          null,
          'recent_triggers',
          'What situations, emotions, or events have been pulling at you?',
        )
      case 'spiritual':
        return choiceCards('Where are you spiritually?', SPIRITUAL_CONDITIONS, 'spiritual_condition')
      case 'honesty':
        return textStep(
          'Am I hiding anything?',
          'This is between you and God. Be honest.',
          'honesty_check',
          'Be real here. No one sees this but you.',
        )
      case 'next':
        return textStep(
          'One intentional next step',
          "What's one thing you can do today to stay grounded?",
          'next_step',
          'I will...',
          'min-h-[100px]',
        )
      case 'intensity':
        return (
          <IntensitySlider
            label="How intense is this feeling?"
            value={draft.intensity ?? 5}
            onChange={(v) => set('intensity', v)}
            lowLabel="Mild"
            highLabel="Overwhelming"
          />
        )
      case 'body':
        return (
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium text-foreground">
              Where do you feel this in your body?
            </legend>
            <div className="flex flex-wrap gap-2">
              {BODY_AREAS.map((area) => (
                <Chip
                  key={area}
                  selected={draft.body_awareness === area}
                  onClick={() => set('body_awareness', area)}
                >
                  {area}
                </Chip>
              ))}
            </div>
          </fieldset>
        )
      case 'fear':
        return textStep(
          'What is your primary fear right now?',
          null,
          'primary_fear',
          'What are you most afraid of in this moment?',
        )
      case 'need':
        return choiceCards('What do you need right now?', CURRENT_NEEDS, 'current_need')
      case 'reflection':
        return textStep(
          'Short reflection',
          'What would help you find your footing right now?',
          'reflection',
          'Write freely...',
        )
      default:
        return null
    }
  }

  const isLast = step === steps.length - 1

  return (
    <Screen>
      <h1 className="mb-1 font-display text-xl font-semibold text-foreground">Daily Check-In</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {isMen ? 'Honest awareness, not performance.' : 'Your emotions are valid. Name them.'}
      </p>
      <StepProgress total={steps.length} current={step} className="mb-6 gap-1" />
      <p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">{steps[step]!.label}</p>

      <div key={`${track}-${step}`} className="animate-step-in">
        {renderStep()}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => goTo(step - 1)} className="flex-1">
            <ChevronLeft aria-hidden="true" /> Back
          </Button>
        )}
        {isLast ? (
          <Button onClick={() => void complete()} className="flex-1" disabled={create.isPending}>
            <Check aria-hidden="true" /> {create.isPending ? 'Saving...' : 'Complete'}
          </Button>
        ) : (
          <Button onClick={() => goTo(step + 1)} className="flex-1" disabled={step === 0 && !hasEmotion}>
            Next <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </Screen>
  )
}
