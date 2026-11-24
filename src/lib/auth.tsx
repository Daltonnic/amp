import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthError } from '@supabase/supabase-js'
import { DEVICE_USER_ID } from '@/data/deviceBackend'
import { config, isCloudConfigured } from './config'
import { isNative } from './native'
import { forgetDeviceOnSignOut } from './push'
import { getSupabase } from './supabase'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; email: string | null }

export const MIN_PASSWORD_LENGTH = 8

interface AuthContextValue {
  state: AuthState
  /** True after opening a password-reset link, until a new password is saved. */
  recovering: boolean
  signIn(email: string, password: string): Promise<void>
  /** Creates the account. Resolves 'signed-in', or 'confirm-email' if the project requires confirmation. */
  signUp(email: string, password: string): Promise<'signed-in' | 'confirm-email'>
  /** Emails a link for choosing a new password. */
  sendPasswordReset(email: string): Promise<void>
  /** Sets a new password for the signed-in (or recovering) user. */
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Where password-reset links should land. */
function resetRedirectUrl(): string | undefined {
  if (!isNative) return `${window.location.origin}/reset-password`
  // The phone apps can't receive the link; it opens the web app instead.
  return config.webUrl ? `${config.webUrl.replace(/\/$/, '')}/reset-password` : undefined
}

/** Friendly wording for Supabase auth errors. */
export function authErrorMessage(err: unknown): string {
  if (err instanceof AuthError) {
    switch (err.code) {
      case 'invalid_credentials':
        return 'That email and password combination is incorrect.'
      case 'user_already_exists':
      case 'email_exists':
        return 'An account with this email already exists. Sign in instead.'
      case 'weak_password':
        return `Choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`
      case 'email_address_invalid':
        return 'Enter a valid email address.'
      case 'same_password':
        return 'Your new password must be different from the old one.'
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return 'Too many attempts. Please wait a few minutes and try again.'
      case 'email_not_confirmed':
        return 'Please confirm your email address first, using the link we sent you.'
    }
    if (err.status === 0 || err.name === 'AuthRetryableFetchError') {
      return "We couldn't reach the server. Check your connection and try again."
    }
  }
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>(() =>
    isCloudConfigured ? { status: 'loading' } : { status: 'signed-in', userId: DEVICE_USER_ID, email: null },
  )
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!isCloudConfigured) return
    const sb = getSupabase()
    let previousUser: string | null = null
    const apply = (userId: string | null, email: string | null) => {
      // Never let one account's cached data be shown to another.
      if (previousUser !== userId) queryClient.clear()
      previousUser = userId
      setState(userId ? { status: 'signed-in', userId, email } : { status: 'signed-out' })
    }
    void sb.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      apply(user?.id ?? null, user?.email ?? null)
    })
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      apply(session?.user.id ?? null, session?.user.email ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: isNative ? config.webUrl || undefined : window.location.origin },
    })
    if (error) throw error
    return data.session ? 'signed-in' : 'confirm-email'
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: resetRedirectUrl(),
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password })
    if (error) throw error
    setRecovering(false)
  }, [])

  const signOut = useCallback(async () => {
    if (!isCloudConfigured) return
    // Stop this device getting the account's notifications before signing out.
    await forgetDeviceOnSignOut()
    await getSupabase().auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({ state, recovering, signIn, signUp, sendPasswordReset, updatePassword, signOut }),
    [state, recovering, signIn, signUp, sendPasswordReset, updatePassword, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
