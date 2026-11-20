import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DEVICE_USER_ID } from '@/data/deviceBackend'
import { isCloudConfigured } from './config'
import { getSupabase } from './supabase'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; email: string | null }

interface AuthContextValue {
  state: AuthState
  /** Emails a 6-digit sign-in code. Creates the account on first use. */
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
  /** For accounts given a password (e.g. the App Store review demo account). */
  signInWithPassword(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>(() =>
    isCloudConfigured ? { status: 'loading' } : { status: 'signed-in', userId: DEVICE_USER_ID, email: null },
  )

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
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      apply(session?.user.id ?? null, session?.user.email ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const sendCode = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    })
    if (error) throw error
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await getSupabase().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    if (error) throw error
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!isCloudConfigured) return
    await getSupabase().auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo(
    () => ({ state, sendCode, verifyCode, signInWithPassword, signOut }),
    [state, sendCode, verifyCode, signInWithPassword, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
