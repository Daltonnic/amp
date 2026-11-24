import { Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { App as CapApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { WifiOff } from 'lucide-react'
import { PageBackground } from '@/components/PageBackground'
import { TabBar } from '@/components/TabBar'
import { useGroupLive, useGroupStatus, useMyRoom } from '@/data/groupQueries'
import { useProfile } from '@/data/queries'
import { useAuth } from '@/lib/auth'
import { useKeyboardOpen } from '@/lib/keyboard'
import { isNative, platform } from '@/lib/native'
import { handleNotificationTaps, syncPush } from '@/lib/push'
import { onReminderTapped } from '@/lib/reminders'
import { paths } from './routes'

export function FullScreenSpinner() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-background"
      role="status"
      aria-label="Loading"
    >
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  )
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/** Hides the tab bar while the on-screen keyboard is up (e.g. writing a journal entry). */
/** Android back button, reminder taps and splash screen. */
function NativeBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isNative) return
    void SplashScreen.hide().catch(() => {})
    const cleanups: Array<() => void> = []
    void onReminderTapped((route) => navigate(route)).then((off) => cleanups.push(off))
    if (platform === 'android') {
      void CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else void CapApp.minimizeApp()
      }).then((h) => cleanups.push(() => void h.remove()))
    }
    return () => cleanups.forEach((fn) => fn())
  }, [navigate])
  return null
}

/** Signed-in area with the bottom tab bar. Sends new users to onboarding. */
export function TabsLayout() {
  const location = useLocation()
  const profile = useProfile()
  const online = useOnline()
  const keyboardOpen = useKeyboardOpen()

  if (profile.isPending) return <FullScreenSpinner />
  if (profile.isError) return <LoadError onRetry={() => void profile.refetch()} />
  if (!profile.data) return <Navigate to={paths.welcome} replace />

  return (
    <div className="min-h-dvh pt-safe">
      {!online && (
        <div
          role="status"
          className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground"
        >
          <WifiOff className="size-3.5" aria-hidden="true" /> You're offline. Grounding tools and Scripture
          still work.
        </div>
      )}
      <main
        // Re-keying on the path restarts the enter animation on navigation.
        key={location.pathname}
        className="animate-page-in"
        style={{
          paddingBottom: keyboardOpen ? 16 : 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <Suspense fallback={<FullScreenSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      {!keyboardOpen && <TabBar />}
      <GroupLive />
    </div>
  )
}

/** Opens the group when a notification is tapped; keeps this device's push registration current. */
function PushBridge() {
  const navigate = useNavigate()
  const { state } = useAuth()
  const userId = state.status === 'signed-in' ? state.userId : null
  useEffect(() => handleNotificationTaps((url) => navigate(url)), [navigate])
  useEffect(() => {
    if (userId) void syncPush(userId).catch(() => {})
  }, [userId])
  return null
}

/** Live group messages and the unread badge, while the app is open. */
function GroupLive() {
  const room = useMyRoom()
  const status = useGroupStatus(room)
  useGroupLive(room, Boolean(status.data?.member))
  return null
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center pt-safe">
      <p className="font-display text-lg font-semibold">We couldn't load your journey</p>
      <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  )
}

/** Root: auth gate + native wiring. */
export function RootLayout() {
  const { state, recovering } = useAuth()
  const location = useLocation()

  const publicPaths: string[] = [paths.signIn, paths.privacy, paths.resetPassword]
  const isPublic = publicPaths.includes(location.pathname)

  let content
  if (state.status === 'loading') content = <FullScreenSpinner />
  else if (recovering && location.pathname !== paths.resetPassword)
    content = <Navigate to={paths.resetPassword} replace />
  else if (state.status === 'signed-out' && !isPublic) content = <Navigate to={paths.signIn} replace />
  else if (state.status === 'signed-in' && location.pathname === paths.signIn)
    content = <Navigate to={paths.home} replace />
  else
    content = (
      <Suspense fallback={<FullScreenSpinner />}>
        <Outlet />
      </Suspense>
    )

  return (
    <>
      <NativeBridge />
      <PushBridge />
      <ScrollRestoration />
      <PageBackground />
      {content}
    </>
  )
}
