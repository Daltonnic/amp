import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Lock } from 'lucide-react'
import { BrandLogo } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/controls'
import { paths } from '@/app/routes'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/utils'

export default function SignIn() {
  const { sendCode, verifyCode, signInWithPassword } = useAuth()
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      await sendCode(email)
      setStep('code')
      setCode('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await verifyCode(email, code)
      // The auth listener redirects once the session is stored.
    } catch {
      setError("That code didn't work. Check the latest email and try again.")
      setBusy(false)
    }
  }

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signInWithPassword(email, password)
    } catch {
      setError('That email and password combination did not work.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <BrandLogo className="mx-auto mb-8 h-auto w-56" />

        {step === 'email' ? (
          <form onSubmit={requestCode} className="space-y-5">
            <div className="space-y-1 text-center">
              <h1 className="font-display text-2xl font-semibold">Welcome to The Journey</h1>
              <p className="text-sm text-muted-foreground">Sign in or create your account with your email.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email.includes('@')}>
              {busy ? 'Sending code…' : 'Continue'}
              {!busy && <ArrowRight aria-hidden="true" />}
            </Button>
            <button
              type="button"
              className="min-h-11 w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStep('password')
                setError('')
              }}
            >
              Sign in with a password
            </button>
          </form>
        ) : step === 'password' ? (
          <form onSubmit={submitPassword} className="space-y-5">
            <div className="space-y-1 text-center">
              <h1 className="font-display text-2xl font-semibold">Sign in with password</h1>
              <p className="text-sm text-muted-foreground">For accounts that were given a password.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-email">Email</Label>
              <Input
                id="pw-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <button
              type="button"
              className="min-h-11 w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setStep('email')
                setError('')
              }}
            >
              Use an email code instead
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-5">
            <div className="space-y-1 text-center">
              <h1 className="font-display text-2xl font-semibold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Sign-in code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
                className="text-center text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="min-h-11 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep('email')
                  setError('')
                }}
              >
                Use a different email
              </button>
              <button
                type="button"
                className="min-h-11 text-primary disabled:opacity-50"
                disabled={busy}
                onClick={() => void requestCode()}
              >
                Resend code
              </button>
            </div>
          </form>
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
