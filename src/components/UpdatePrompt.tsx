import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isNative } from '@/lib/native'

/** Offers to reload when a new PWA version is ready. Not used inside the native apps. */
export function UpdatePrompt() {
  if (isNative) return null
  return <WebUpdatePrompt />
}

function WebUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app is open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    toast('A new version of AMP is ready.', {
      id: 'sw-update',
      duration: Infinity,
      action: { label: 'Update', onClick: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
