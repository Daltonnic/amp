import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  ExternalLink,
  KeyRound,
  LogOut,
  Moon,
  RotateCcw,
  Shield,
  Smartphone,
  Sun,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { paths } from '@/app/routes'
import { PageHeader, Screen } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label, Switch, Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { backend } from '@/data'
import { useDeleteProfile, useProfile, useUpdateProfile } from '@/data/queries'
import type { Gender, Profile } from '@/data/types'
import { trackLabel } from '@/lib/audience'
import { usePush } from '@/data/pushQueries'
import type { PushState } from '@/lib/push'
import { NameFields, namePartsOf, profileNamePatch } from '@/components/NameFields'
import { GROUP_ROOMS, roomFor } from '@/content/group'
import {
  useBlockMember,
  useGroupBlocks,
  useGroupMembers,
  useGroupStatus,
  useLeaveGroup,
  useMyRoom,
} from '@/data/groupQueries'
import {
  biometryInfo,
  clearLock,
  getLockConfig,
  isValidPin,
  setBiometrics,
  setPin,
  type BiometryInfo,
} from '@/lib/appLock'
import { useAuth } from '@/lib/auth'
import { config, isCloudConfigured } from '@/lib/config'
import { hapticSuccess, isNative } from '@/lib/native'
import { clearReminders, remindersSupported, syncReminders } from '@/lib/reminders'
import { useTheme, type ThemePreference } from '@/lib/theme'
import { errorMessage } from '@/lib/utils'

export default function Settings() {
  const profile = useProfile()
  if (!profile.data) return null
  // Re-key on save so the form re-initialises from the stored profile.
  return <SettingsForm key={profile.data.updated_at} profile={profile.data} />
}

function SettingsForm({ profile: p }: { profile: Profile }) {
  const update = useUpdateProfile()
  const { state } = useAuth()
  const [name, setName] = useState(() => namePartsOf(p))
  const [gender, setGender] = useState<Gender | null>(p.gender ?? null)
  const [reminders, setReminders] = useState(p.daily_reminders)
  const [reminderTime, setReminderTime] = useState(p.reminder_time.slice(0, 5))

  const nameChanged =
    JSON.stringify(profileNamePatch(name)) !== JSON.stringify(profileNamePatch(namePartsOf(p)))
  const currentRoom = useMyRoom()
  const groupStatus = useGroupStatus(currentRoom)
  const inGroup = Boolean(groupStatus.data?.member)
  const movesGroup = inGroup && currentRoom !== roomFor(p.track, gender)
  const dirty =
    nameChanged ||
    gender !== (p.gender ?? null) ||
    reminders !== p.daily_reminders ||
    reminderTime !== p.reminder_time.slice(0, 5)

  const save = async () => {
    try {
      await update.mutateAsync({
        id: p.id,
        patch: {
          ...profileNamePatch(name),
          gender,
          daily_reminders: reminders,
          reminder_time: reminderTime,
        },
      })
      const result = await syncReminders(reminders, reminderTime)
      if (result === 'denied') {
        toast.warning(
          'Notifications are turned off for AMP. Allow them in your phone’s Settings to get reminders.',
        )
      } else {
        hapticSuccess()
        toast.success('Settings saved.')
      }
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Screen className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your experience." />

      <Section title="Profile">
        <NameFields value={name} onChange={setName} />
        <div className="space-y-1.5">
          <p id="gender-label" className="text-xs text-muted-foreground">
            I am a
          </p>
          <Tabs value={gender ?? ''} onValueChange={(v) => setGender(v as Gender)}>
            <TabsList className="w-full" aria-labelledby="gender-label">
              <TabsTrigger value="man" className="flex-1">
                Man
              </TabsTrigger>
              <TabsTrigger value="woman" className="flex-1">
                Woman
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {!gender && (
            <p className="text-xs text-muted-foreground">
              Choose one so we can show you the right words, pictures and group.
            </p>
          )}
          {movesGroup && currentRoom && (
            <p className="text-xs font-medium text-destructive">
              Saving this takes you out of {GROUP_ROOMS[currentRoom].name}.
            </p>
          )}
        </div>
        <Row title="Track" subtitle={trackLabel(p.track, gender)} />
        {state.status === 'signed-in' && state.email && <Row title="Signed in as" subtitle={state.email} />}
      </Section>

      <Section title="Notifications">
        <PushSettings />
        <Row title="Daily Reminders" subtitle="Gentle nudges to check in">
          <Switch checked={reminders} onCheckedChange={setReminders} aria-label="Daily reminders" />
        </Row>
        {reminders &&
          (remindersSupported ? (
            <Row title="Reminder time">
              <input
                type="time"
                aria-label="Reminder time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value || '20:00')}
                className="min-h-11 rounded-md border border-input bg-card px-3"
              />
            </Row>
          ) : (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Reminders are delivered by the iPhone and Android apps.
            </p>
          ))}
      </Section>

      <Button onClick={() => void save()} disabled={!dirty || update.isPending} className="w-full">
        {update.isPending ? 'Saving...' : 'Save Settings'}
      </Button>

      {inGroup && currentRoom && <GroupSection room={currentRoom} />}

      <AppearanceSection />
      <SecuritySection />

      <Section title="About">
        <Link
          to={paths.privacy}
          className="flex min-h-11 items-center justify-between text-sm text-foreground"
        >
          Privacy Policy <ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
        {config.supportEmail && (
          <a
            href={`mailto:${config.supportEmail}`}
            className="flex min-h-11 items-center justify-between text-sm text-foreground"
          >
            Contact support <ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" />
          </a>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          AMP is a support tool, not a substitute for a pastor, counselor, or medical care. In a crisis in the
          U.S., call or text{' '}
          <a href="tel:988" className="font-medium underline">
            988
          </a>
          , or call 911.
        </p>
        <p className="text-xs text-muted-foreground">Version {config.appVersion}</p>
      </Section>

      <AccountSection profileId={p.id} />
    </Screen>
  )
}

/** Push notifications for this device: on/off, and whether to show message text. */
function PushSettings() {
  const push = usePush()
  const toggle = (on: boolean) => {
    const done = {
      onSuccess: (state?: PushState) => {
        if (state === 'blocked')
          toast.error('Notifications are blocked for AMP. Allow them in your settings first.')
        else hapticSuccess()
      },
      onError: (err: unknown) => toast.error(errorMessage(err)),
    }
    if (on) push.enable.mutate(undefined, done)
    else push.disable.mutate(undefined, { ...done, onSuccess: () => done.onSuccess() })
  }

  if (push.support === 'ios-browser') {
    return (
      <Row
        title="Push notifications"
        subtitle="On iPhone and iPad, first add AMP to your Home Screen (tap Share, then Add to Home Screen), then open AMP from there and turn this on."
      />
    )
  }
  if (!push.available) {
    return <Row title="Push notifications" subtitle="Not available in this browser or version of the app." />
  }

  const on = push.state === 'on'
  return (
    <>
      <Row title="Push notifications" subtitle="New messages in your group, even when AMP is closed">
        <Switch
          checked={on}
          disabled={push.busy || push.state === undefined || push.state === 'blocked'}
          onCheckedChange={toggle}
          aria-label="Push notifications"
        />
      </Row>
      {push.state === 'blocked' && (
        <p className="-mt-2 text-xs text-destructive">
          Notifications are blocked for AMP on this device. Allow them in your{' '}
          {isNative ? 'phone' : 'browser'} settings, then come back here.
        </p>
      )}
      {on && (
        <Row
          title="Show message text"
          subtitle={
            push.preview
              ? 'Notifications show the group, name and message.'
              : 'Off for privacy: notifications just say “New message in your group”.'
          }
        >
          <Switch
            checked={push.preview}
            disabled={push.changePreview.isPending}
            onCheckedChange={(show) =>
              push.changePreview.mutate(show, { onError: (err) => toast.error(errorMessage(err)) })
            }
            aria-label="Show message text in notifications"
          />
        </Row>
      )}
    </>
  )
}

function GroupSection({ room }: { room: NonNullable<ReturnType<typeof useMyRoom>> }) {
  const members = useGroupMembers(room, true)
  const blocks = useGroupBlocks(true)
  const block = useBlockMember()
  const leave = useLeaveGroup(room)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const nameOf = (id: string) => members.data?.find((m) => m.user_id === id)?.display_name ?? 'Former member'
  const blocked = blocks.data ?? []

  return (
    <Section title="Group">
      <Row title="Your group" subtitle={GROUP_ROOMS[room].name} />
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Blocked people</p>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven’t blocked anyone.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {blocked.map((id) => (
              <li key={id} className="flex items-center justify-between gap-3 px-3 py-1">
                <span className="truncate text-sm text-foreground">{nameOf(id)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    block.mutate(
                      { userId: id, block: false },
                      { onError: (err) => toast.error(errorMessage(err)) },
                    )
                  }
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {confirmLeave ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm text-foreground">
            Leave the group? You can join again any time from the Group tab.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmLeave(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={leave.isPending}
              onClick={() =>
                leave.mutate(undefined, {
                  onSuccess: () => toast.success('You left the group.'),
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Leave group
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setConfirmLeave(true)}>
          Leave group
        </Button>
      )}
    </Section>
  )
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </Card>
  )
}

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

function AppearanceSection() {
  const [theme, setTheme] = useTheme()
  return (
    <Section title="Appearance">
      <Tabs value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
        <TabsList className="w-full">
          <TabsTrigger value="system" className="flex-1">
            <Smartphone className="mr-1.5 size-3.5" aria-hidden="true" /> System
          </TabsTrigger>
          <TabsTrigger value="light" className="flex-1">
            <Sun className="mr-1.5 size-3.5" aria-hidden="true" /> Light
          </TabsTrigger>
          <TabsTrigger value="dark" className="flex-1">
            <Moon className="mr-1.5 size-3.5" aria-hidden="true" /> Dark
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </Section>
  )
}

function SecuritySection() {
  const [lockOn, setLockOn] = useState(false)
  const [bioOn, setBioOn] = useState(false)
  const [bio, setBio] = useState<BiometryInfo>({ available: false, label: '' })
  const [pinDialog, setPinDialog] = useState(false)

  useEffect(() => {
    void getLockConfig().then((c) => {
      setLockOn(Boolean(c))
      setBioOn(Boolean(c?.biometrics))
    })
    void biometryInfo().then(setBio)
  }, [])

  const toggleLock = async (on: boolean) => {
    if (on) return setPinDialog(true)
    await clearLock()
    setLockOn(false)
    setBioOn(false)
    toast.success('PIN lock turned off.')
  }

  return (
    <Section title="Privacy & Security" icon={<Shield className="size-4 text-primary" aria-hidden="true" />}>
      <Row title="PIN Lock" subtitle="Require a PIN to open the app">
        <Switch checked={lockOn} onCheckedChange={(v) => void toggleLock(v)} aria-label="PIN lock" />
      </Row>
      {lockOn && bio.available && (
        <Row title={`Unlock with ${bio.label}`}>
          <Switch
            checked={bioOn}
            aria-label={`Unlock with ${bio.label}`}
            onCheckedChange={(v) => {
              setBioOn(v)
              void setBiometrics(v)
            }}
          />
        </Row>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Your PIN never leaves this device. Your journal entries and check-ins are encrypted in transit and at
        rest, and only you can access them.
      </p>
      <SetPinDialog
        open={pinDialog}
        onOpenChange={setPinDialog}
        offerBiometrics={bio.available ? bio.label : ''}
        onDone={(withBio) => {
          setLockOn(true)
          setBioOn(withBio)
        }}
      />
    </Section>
  )
}

function SetPinDialog({
  open,
  onOpenChange,
  offerBiometrics,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  offerBiometrics: string
  onDone: (withBiometrics: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a PIN</DialogTitle>
          <DialogDescription>
            Choose a 4–6 digit PIN. You'll enter it when you open AMP.
            {offerBiometrics && ` You can also unlock with ${offerBiometrics}.`}
          </DialogDescription>
        </DialogHeader>
        {/* Unmounts when the dialog closes, so the fields reset each time. */}
        <PinForm
          offerBiometrics={offerBiometrics}
          onDone={(withBio) => {
            onDone(withBio)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function PinForm({
  offerBiometrics,
  onDone,
}: {
  offerBiometrics: string
  onDone: (withBiometrics: boolean) => void
}) {
  const [pin, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    if (!isValidPin(pin)) return setError('Use 4 to 6 digits.')
    if (pin !== confirm) return setError("The PINs don't match.")
    const withBio = Boolean(offerBiometrics)
    await setPin(pin, withBio)
    hapticSuccess()
    toast.success('PIN lock is on.')
    onDone(withBio)
  }

  const pinInput = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
        className="text-center text-xl tracking-[0.4em]"
      />
    </div>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {pinInput('new-pin', 'PIN', pin, setPinValue)}
      {pinInput('confirm-pin', 'Confirm PIN', confirm, setConfirm)}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pin.length < 4 || confirm.length < 4}>
        Turn on PIN Lock
      </Button>
    </form>
  )
}

function AccountSection({ profileId }: { profileId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { signOut } = useAuth()
  const deleteProfile = useDeleteProfile()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const resetOnboarding = async () => {
    try {
      await deleteProfile.mutateAsync(profileId)
      navigate(paths.welcome, { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const deleteEverything = async () => {
    setDeleting(true)
    try {
      await backend.deleteAccount()
      await Promise.all([clearLock(), clearReminders()])
      try {
        localStorage.removeItem('amp.journalDraft')
      } catch {
        /* ignore */
      }
      queryClient.clear()
      toast.success('Your account and all of your data have been deleted.')
      navigate(isCloudConfigured ? paths.signIn : paths.welcome, { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-muted-foreground">
            <RotateCcw className="size-3.5" aria-hidden="true" /> Reset Onboarding
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Reset onboarding?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll choose your track and needs again. Your check-ins, journal and other entries are kept.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void resetOnboarding()}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isCloudConfigured && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => navigate(paths.resetPassword)}
          >
            <KeyRound className="size-3.5" aria-hidden="true" /> Change Password
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => void signOut().then(() => navigate(paths.signIn, { replace: true }))}
          >
            <LogOut className="size-3.5" aria-hidden="true" /> Sign Out
          </Button>
        </>
      )}

      <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="size-3.5" aria-hidden="true" /> Delete Account & All Data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will permanently delete your account and all your data — check-ins, journal entries,
                trigger logs, grounding sessions, contacts, and your profile. This cannot be undone.
              </p>
              <p className="font-medium text-foreground">
                Type <span className="font-semibold text-destructive">DELETE</span> to confirm.
              </p>
              <Input
                aria-label="Type DELETE to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE here"
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={confirmText !== 'DELETE' || deleting}
              onClick={(e) => {
                e.preventDefault()
                void deleteEverything()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
