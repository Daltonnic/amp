import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, Lock, MailCheck } from 'lucide-react'
import { BrandLogo } from '@/components/BrandMark'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/controls'
import { paths } from '@/app/routes'
import { authErrorMessage, MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth'

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'reset-sent' | 'confirm-email'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function SignIn() {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>(
    (location.state as { mode?: Mode } | null)?.mode === 'forgot' ? 'forgot' : 'sign-in',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const go = (next: Mode) => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
  }

  const run = async (action: () => Promise<void>) => {
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onSignIn = (e: FormEvent) => {
    e.preventDefault()
    // On success the auth listener moves the person into the app.
    void run(() => signIn(email, password))
  }

  const onSignUp = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`)
      return
    }
    if (password !== confirm) {
      setError("The passwords don't match.")
      return
    }
    void run(async () => {
      if ((await signUp(email, password)) === 'confirm-email') go('confirm-email')
    })
  }

  const onForgot = (e: FormEvent) => {
    e.preventDefault()
    void run(async () => {
      await sendPasswordReset(email)
      go('reset-sent')
    })
  }

  const emailField = (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        inputMode="email"
        autoComplete={mode === 'sign-up' ? 'email' : 'username'}
        autoCapitalize="none"
        spellCheck={false}
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>
  )

  const errorText = error && (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  )

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <BrandLogo className="mx-auto mb-8 h-auto w-56" />

        {mode === 'sign-in' && (
          <form onSubmit={onSignIn} className="space-y-5">
            <Heading title="Welcome to The Journey" subtitle="Sign in to continue." />
            {emailField}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="-my-3 min-h-11 text-sm text-primary"
                  onClick={() => go('forgot')}
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {errorText}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={busy || !EMAIL_RE.test(email) || !password}
            >
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <ArrowRight aria-hidden="true" />}
            </Button>
            <SwitchLink prompt="New here?" action="Create an account" onClick={() => go('sign-up')} />
          </form>
        )}

        {mode === 'sign-up' && (
          <form onSubmit={onSignUp} className="space-y-5">
            <Heading title="Create your account" subtitle="Private, secure, and just for you." />
            {emailField}
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                aria-describedby="password-hint"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p id="password-hint" className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {errorText}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={busy || !EMAIL_RE.test(email) || !password || !confirm}
            >
              {busy ? 'Creating account…' : 'Create account'}
              {!busy && <ArrowRight aria-hidden="true" />}
            </Button>
            <SwitchLink prompt="Already have an account?" action="Sign in" onClick={() => go('sign-in')} />
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={onForgot} className="space-y-5">
            <Heading
              title="Reset your password"
              subtitle="Enter your email and we'll send you a link to choose a new password."
            />
            {emailField}
            {errorText}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !EMAIL_RE.test(email)}>
              {busy ? 'Sending…' : 'Send reset link'}
            </Button>
            <SwitchLink prompt="Remembered it?" action="Back to sign in" onClick={() => go('sign-in')} />
          </form>
        )}

        {(mode === 'reset-sent' || mode === 'confirm-email') && (
          <div className="space-y-5 text-center">
            <MailCheck className="mx-auto size-10 text-primary" aria-hidden="true" />
            <Heading
              title="Check your email"
              subtitle={
                mode === 'reset-sent'
                  ? `If an account exists for ${email}, we've sent a link to reset your password. Open it on this device.`
                  : `We sent a confirmation link to ${email}. Open it to finish creating your account.`
              }
            />
            <Button variant="outline" className="w-full" onClick={() => go('sign-in')}>
              Back to sign in
            </Button>
          </div>
        )}

        <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          Your data is private and secure.{' '}
          <Link to={paths.privacy} className="underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}

function Heading({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="space-y-1 text-center">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function SwitchLink({ prompt, action, onClick }: { prompt: string; action: string; onClick: () => void }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{' '}
      <button type="button" className="min-h-11 font-medium text-primary" onClick={onClick}>
        {action}
      </button>
    </p>
  )
}
