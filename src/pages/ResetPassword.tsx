import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { CircleCheck, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { paths } from '@/app/routes'
import { FullScreenSpinner } from '@/app/AppShell'
import { BrandMark } from '@/components/BrandMark'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/controls'
import { authErrorMessage, MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth'
import { isCloudConfigured } from '@/lib/config'
import { hapticSuccess } from '@/lib/native'

/**
 * Choose a new password. Reached from the "reset your password" email link
 * (which signs the person in for this purpose) or from Settings → Change
 * Password.
 */
export default function ResetPassword() {
  const { state, recovering, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!isCloudConfigured) return <Navigate to={paths.home} replace />
  if (state.status === 'loading') return <FullScreenSpinner />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError("The passwords don't match.")
      return
    }
    setError('')
    setBusy(true)
    try {
      await updatePassword(password)
      hapticSuccess()
      setDone(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10">
        <BrandMark className="mx-auto size-16" />

        {state.status === 'signed-out' ? (
          <div className="space-y-5 text-center">
            <h1 className="font-display text-2xl font-semibold">This link has expired</h1>
            <p className="text-sm text-muted-foreground">
              Password reset links work once and expire after an hour. Request a new one to continue.
            </p>
            <Button className="w-full" onClick={() => navigate(paths.signIn, { state: { mode: 'forgot' } })}>
              Request a new link
            </Button>
          </div>
        ) : done ? (
          <div className="space-y-5 text-center">
            <CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />
            <h1 className="font-display text-2xl font-semibold">Password updated</h1>
            <p className="text-sm text-muted-foreground">
              Use your new password the next time you sign in on any device.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                toast.success('Password updated.')
                navigate(paths.home, { replace: true })
              }}
            >
              Continue
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1 text-center">
              <KeyRound className="mx-auto mb-2 size-6 text-primary" aria-hidden="true" />
              <h1 className="font-display text-2xl font-semibold">
                {recovering ? 'Choose a new password' : 'Change your password'}
              </h1>
              {state.email && <p className="text-sm text-muted-foreground">For {state.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New password</Label>
              <PasswordInput
                id="reset-password"
                autoComplete="new-password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm">Confirm new password</Label>
              <PasswordInput
                id="reset-confirm"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !password || !confirm}>
              {busy ? 'Saving…' : 'Save new password'}
            </Button>
            {!recovering && (
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
