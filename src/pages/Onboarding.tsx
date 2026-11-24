import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ArrowRight, ChevronLeft, Heart, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { paths } from '@/app/routes'
import { FullScreenSpinner } from '@/app/AppShell'
import { OptionCard, StepProgress } from '@/components/inputs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/controls'
import { Textarea } from '@/components/ui/input'
import { NEEDS, ONBOARDING_STEPS, REMINDER_EXAMPLES } from '@/content/onboarding'
import { useCreateProfile, useProfile } from '@/data/queries'
import type { Gender, Track } from '@/data/types'
import { GENDER_OPTIONS } from '@/lib/audience'
import { isNameComplete, type NameParts } from '@/lib/names'
import { NameFields, profileNamePatch } from '@/components/NameFields'
import { hapticSuccess } from '@/lib/native'
import { remindersSupported, syncReminders } from '@/lib/reminders'
import { errorMessage } from '@/lib/utils'

const DEFAULT_REMINDER_TIME = '20:00'
const MAX_NEEDS = 3

export default function Onboarding() {
  const navigate = useNavigate()
  const profile = useProfile()
  const createProfile = useCreateProfile()
  const [step, setStep] = useState(0)
  const [name, setName] = useState<NameParts>({
    first: '',
    last: '',
    style: 'first_last_initial',
    nickname: '',
  })
  const [gender, setGender] = useState<Gender | ''>('')
  const [track, setTrack] = useState<Track | ''>('')
  const [reason, setReason] = useState('')
  const [needs, setNeeds] = useState<string[]>([])
  const [reminders, setReminders] = useState(true)
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME)

  if (profile.isPending) return <FullScreenSpinner />
  if (profile.data && !createProfile.isPending) return <Navigate to={paths.home} replace />

  const current = ONBOARDING_STEPS[step]!
  const isLast = step === ONBOARDING_STEPS.length - 1
  const canContinue =
    current.id === 'name'
      ? isNameComplete(name)
      : current.id === 'about'
        ? Boolean(gender)
        : current.id === 'track'
          ? Boolean(track)
          : current.id === 'reason'
            ? reason.trim().length > 0
            : current.id === 'need'
              ? needs.length > 0
              : true

  const finish = async () => {
    if (!track || !gender || !isNameComplete(name)) return
    try {
      await createProfile.mutateAsync({
        track,
        gender,
        reason: reason.trim(),
        primary_needs: needs,
        ...profileNamePatch(name),
        freedom_start: null,
        freedom_best_days: 0,
        freedom_hidden: false,
        daily_reminders: reminders,
        reminder_time: reminderTime,
        onboarding_complete: true,
      })
      hapticSuccess()
      if (reminders && remindersSupported) {
        const result = await syncReminders(true, reminderTime)
        if (result === 'denied') toast('Reminders are off. You can allow notifications in Settings anytime.')
      }
      navigate(paths.home, { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const next = () => (isLast ? void finish() : setStep(step + 1))
  const options = NEEDS[track === 'spouse' ? 'spouse' : 'men']

  return (
    <div className="flex min-h-dvh flex-col pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="px-6 pb-2 pt-6">
          <StepProgress total={ONBOARDING_STEPS.length} current={step} />
        </div>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="inline-flex min-h-11 items-center gap-1 self-start px-6 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Back
          </button>
        ) : (
          <div className="h-11" />
        )}

        <div className="flex flex-1 flex-col px-6 py-6">
          <div key={step} className="flex flex-1 animate-step-in flex-col">
            <h1 className="mb-2 font-display text-2xl font-semibold text-foreground">{current.title}</h1>
            <p className="mb-8 text-muted-foreground">{current.subtitle}</p>

            <div className="flex-1">
              {current.id === 'welcome' && (
                <div className="space-y-6">
                  <p className="leading-relaxed text-foreground/80">
                    This is a safe space for formation, awareness, and healing. Whether you're taking your
                    first step or continuing a long journey, you belong here.
                  </p>
                  <p className="leading-relaxed text-foreground/80">
                    No performance. No shame. Just honest, steady growth — rooted in Christ and carried by
                    grace.
                  </p>
                  <div className="flex items-center gap-3 pt-4 text-primary">
                    <Shield className="size-5" aria-hidden="true" />
                    <span className="text-sm font-medium">Your data is private and secure.</span>
                  </div>
                </div>
              )}

              {current.id === 'name' && <NameFields value={name} onChange={setName} />}

              {current.id === 'about' && (
                <div className="space-y-4">
                  {GENDER_OPTIONS.map((option) => (
                    <OptionCard
                      key={option.value}
                      selected={gender === option.value}
                      onClick={() => setGender(option.value)}
                      className="p-5"
                    >
                      <span className="font-semibold text-foreground">{option.label}</span>
                    </OptionCard>
                  ))}
                </div>
              )}

              {current.id === 'track' && (
                <div className="space-y-4" role="radiogroup" aria-label="Who is this for?">
                  <OptionCard selected={track === 'men'} onClick={() => setTrack('men')} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-primary/10 p-2.5">
                        <Shield className="size-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-foreground">I'm seeking help for myself</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Formation and support for {gender === 'woman' ? 'women' : 'men'} pursuing freedom
                          from sexual brokenness.
                        </p>
                      </div>
                    </div>
                  </OptionCard>
                  <OptionCard
                    selected={track === 'spouse'}
                    onClick={() => setTrack('spouse')}
                    className="p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-accent p-2.5">
                        <Heart className="size-5 text-accent-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-foreground">I'm a betrayed spouse</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Support, grounding, and care for spouses processing betrayal.
                        </p>
                      </div>
                    </div>
                  </OptionCard>
                </div>
              )}

              {current.id === 'reason' && (
                <Textarea
                  aria-label="What brings you here?"
                  placeholder={
                    track === 'spouse'
                      ? "I'm here because... (Share as much or as little as you'd like)"
                      : "I'm here because... (There's no judgment. Be honest.)"
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={5000}
                  className="min-h-[160px] resize-none"
                />
              )}

              {current.id === 'need' && (
                <div className="space-y-3">
                  <p className="-mt-4 mb-2 text-xs text-muted-foreground">Select up to 3</p>
                  {options.map((option) => {
                    const selected = needs.includes(option.value)
                    const full = needs.length >= MAX_NEEDS
                    return (
                      <OptionCard
                        key={option.value}
                        selected={selected}
                        disabled={!selected && full}
                        onClick={() =>
                          setNeeds(
                            selected ? needs.filter((n) => n !== option.value) : [...needs, option.value],
                          )
                        }
                      >
                        <span className="font-medium text-foreground">{option.label}</span>
                      </OptionCard>
                    )
                  })}
                </div>
              )}

              {current.id === 'reminders' && (
                <div className="space-y-6">
                  <Card className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <h2 className="font-medium text-foreground">Daily check-in reminders</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Gentle prompts to pause and reflect
                      </p>
                    </div>
                    <Switch
                      checked={reminders}
                      onCheckedChange={setReminders}
                      aria-label="Daily check-in reminders"
                    />
                  </Card>
                  {reminders && remindersSupported && (
                    <Card className="flex items-center justify-between gap-4 p-4">
                      <label htmlFor="reminder-time" className="font-medium text-foreground">
                        Remind me at
                      </label>
                      <input
                        id="reminder-time"
                        type="time"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value || DEFAULT_REMINDER_TIME)}
                        className="min-h-11 rounded-md border border-input bg-card px-3"
                      />
                    </Card>
                  )}
                  <div className="space-y-3 rounded-xl bg-muted/50 p-5">
                    <p className="text-sm font-medium text-foreground">Reminders sound like:</p>
                    {REMINDER_EXAMPLES.map((line) => (
                      <p key={line} className="text-sm italic text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                  {!remindersSupported && (
                    <p className="text-xs text-muted-foreground">
                      Reminders are delivered by the iPhone and Android apps. Your preference is saved for
                      when you install them.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={next}
            disabled={!canContinue || createProfile.isPending}
            size="lg"
            className="mt-8 w-full"
          >
            {createProfile.isPending
              ? 'Setting up your journey...'
              : isLast
                ? 'Begin The Journey'
                : 'Continue'}
            {!createProfile.isPending && <ArrowRight aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
