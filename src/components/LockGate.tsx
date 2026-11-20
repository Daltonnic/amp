import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Delete, Fingerprint, ScanFace } from 'lucide-react'
import {
  biometryInfo,
  clearLock,
  getLockConfig,
  RELOCK_AFTER_MS,
  unlockWithBiometrics,
  verifyPin,
} from '@/lib/appLock'
import { useAuth } from '@/lib/auth'
import { backend } from '@/data'
import { hapticTap, hapticWarning, isNative } from '@/lib/native'
import { isCloudConfigured } from '@/lib/config'
import { BrandMark } from './BrandMark'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from './ui/dialog'

/**
 * Covers the app with a PIN pad when App Lock is on: at launch, and when
 * returning after more than 30 seconds in the background. The app stays
 * mounted underneath (inert), so nothing in progress is lost.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    const lockIfConfigured = () => void getLockConfig().then((config) => setLocked(Boolean(config)))
    lockIfConfigured()
    const onHide = () => {
      hiddenAt.current = Date.now()
    }
    const onShow = () => {
      if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) void lockIfConfigured()
      hiddenAt.current = null
    }
    if (isNative) {
      const handle = CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? onShow() : onHide()))
      return () => void handle.then((h) => h.remove())
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? onHide() : onShow())
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <>
      <div inert={locked !== false} aria-hidden={locked !== false || undefined}>
        {locked === null ? null : children}
      </div>
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'] as const

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [bio, setBio] = useState<{ enabled: boolean; label: string }>({ enabled: false, label: '' })
  const [forgotOpen, setForgotOpen] = useState(false)
  const triedBio = useRef(false)

  const tryBiometrics = useCallback(async () => {
    if (await unlockWithBiometrics()) onUnlock()
  }, [onUnlock])

  useEffect(() => {
    void (async () => {
      const [config, info] = await Promise.all([getLockConfig(), biometryInfo()])
      const enabled = Boolean(config?.biometrics && info.available)
      setBio({ enabled, label: info.label })
      if (enabled && !triedBio.current) {
        triedBio.current = true
        void tryBiometrics()
      }
    })()
  }, [tryBiometrics])

  const submit = useCallback(
    async (value: string) => {
      setChecking(true)
      const ok = await verifyPin(value)
      setChecking(false)
      if (ok) {
        onUnlock()
      } else {
        hapticWarning()
        setError('Incorrect PIN. Try again.')
        setPin('')
      }
    },
    [onUnlock],
  )

  const press = (key: (typeof KEYS)[number]) => {
    if (checking) return
    hapticTap()
    setError('')
    if (key === 'del') return setPin((p) => p.slice(0, -1))
    if (key === 'bio') return void tryBiometrics()
    const next = (pin + key).slice(0, 6)
    setPin(next)
  }

  // Physical keyboard support (web/PWA, hardware keyboards).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p + e.key).slice(0, 6))
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Enter') void submit(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pin, submit])

  const forgot = async () => {
    await clearLock()
    if (isCloudConfigured) await signOut()
    else await backend.deleteAccount()
    window.location.replace('/')
  }

  const BioIcon = bio.label === 'Face ID' ? ScanFace : Fingerprint

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),48px)]"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark className="size-16" />
        <h1 className="font-display text-xl font-semibold">Enter your PIN</h1>
        <div
          className="flex h-6 items-center gap-3"
          aria-live="polite"
          aria-label={`${pin.length} digits entered`}
        >
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <span
              key={i}
              className={`size-3 rounded-full border-2 border-primary ${i < pin.length ? 'bg-primary' : ''}`}
            />
          ))}
        </div>
        <p className="min-h-5 text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-4">
        {KEYS.map((key) => {
          if (key === 'bio') {
            return bio.enabled ? (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={`Unlock with ${bio.label}`}
                className="flex aspect-square items-center justify-center rounded-full text-primary active:bg-muted"
              >
                <BioIcon className="size-7" aria-hidden="true" />
              </button>
            ) : (
              <span key={key} />
            )
          }
          if (key === 'del') {
            return (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label="Delete digit"
                className="flex aspect-square items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <Delete className="size-6" aria-hidden="true" />
              </button>
            )
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className="flex aspect-square items-center justify-center rounded-full bg-card text-2xl font-medium shadow-xs active:bg-muted"
            >
              {key}
            </button>
          )
        })}
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-2">
        <button
          type="button"
          disabled={pin.length < 4 || checking}
          onClick={() => void submit(pin)}
          className="min-h-12 w-full rounded-md bg-primary text-base font-medium text-primary-foreground disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Unlock'}
        </button>
        <button
          type="button"
          onClick={() => setForgotOpen(true)}
          className="min-h-11 px-4 text-sm text-muted-foreground"
        >
          Forgot PIN?
        </button>
      </div>

      <AlertDialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Reset your PIN?</AlertDialogTitle>
          <AlertDialogDescription>
            {isCloudConfigured
              ? "You'll be signed out and the PIN will be removed. Your data is safe in your account — sign back in with your email to continue."
              : 'This removes the PIN and erases the data stored on this device.'}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive={!isCloudConfigured} onClick={() => void forgot()}>
              {isCloudConfigured ? 'Sign out' : 'Erase and reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
