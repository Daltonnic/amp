import { lazy } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/auth'
import { LockGate } from '@/components/LockGate'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { RootLayout, TabsLayout } from './AppShell'
import { legacyRedirects, paths } from './routes'

const SignIn = lazy(() => import('@/pages/SignIn'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Home = lazy(() => import('@/pages/Home'))
const CheckIn = lazy(() => import('@/pages/CheckIn'))
const Grounding = lazy(() => import('@/pages/Grounding'))
const Journal = lazy(() => import('@/pages/Journal'))
const Group = lazy(() => import('@/pages/Group'))
const Calendar = lazy(() => import('@/pages/Calendar'))
const Resources = lazy(() => import('@/pages/Resources'))
const Library = lazy(() => import('@/pages/Library'))
const TriggerAwareness = lazy(() => import('@/pages/TriggerAwareness'))
const IdentityFormation = lazy(() => import('@/pages/IdentityFormation'))
const Accountability = lazy(() => import('@/pages/Accountability'))
const Settings = lazy(() => import('@/pages/Settings'))
const Leaders = lazy(() => import('@/pages/Leaders'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Privacy = lazy(() => import('@/pages/Privacy'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Navigate to={paths.home} replace /> },
      { path: paths.signIn, element: <SignIn /> },
      { path: paths.resetPassword, element: <ResetPassword /> },
      { path: paths.privacy, element: <Privacy /> },
      { path: paths.welcome, element: <Onboarding /> },
      {
        element: <TabsLayout />,
        children: [
          { path: paths.home, element: <Home /> },
          { path: paths.checkIn, element: <CheckIn /> },
          { path: paths.grounding, element: <Grounding /> },
          { path: paths.journal, element: <Journal /> },
          { path: paths.group, element: <Group /> },
          { path: paths.calendar, element: <Calendar /> },
          { path: paths.resources, element: <Resources /> },
          { path: paths.library, element: <Library /> },
          { path: paths.triggers, element: <TriggerAwareness /> },
          { path: paths.identity, element: <IdentityFormation /> },
          { path: paths.accountability, element: <Accountability /> },
          { path: paths.settings, element: <Settings /> },
          { path: paths.moderators, element: <Leaders /> },
          { path: paths.notifications, element: <Notifications /> },
        ],
      },
      ...Object.entries(legacyRedirects).map(([from, to]) => ({
        path: from,
        caseSensitive: true,
        element: <LegacyRedirect to={to} />,
      })),
      { path: '*', element: <NotFound /> },
    ],
  },
])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LockGate>
          <RouterProvider router={router} />
        </LockGate>
      </AuthProvider>
      <Toaster
        position="top-center"
        richColors
        closeButton
        offset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        toastOptions={{ className: 'font-sans' }}
      />
      <UpdatePrompt />
    </QueryClientProvider>
  )
}
