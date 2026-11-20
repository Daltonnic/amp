import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { isNative, isStandalonePwa } from '@/lib/native'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'amp.installPromptDismissed'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

/**
 * Invites mobile-browser visitors to add AMP to their home screen until the
 * store apps are live. Android/Chrome uses the native install prompt; iOS
 * Safari gets the Share → Add to Home Screen instructions.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => isNative || isStandalonePwa() || wasDismissed())

  useEffect(() => {
    if (hidden) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [hidden])

  if (hidden || (!deferred && !isIos())) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setHidden(true)
  }

  return (
    <Card className="relative flex items-start gap-3 border-primary/20 bg-primary/5 p-4 pr-12">
      <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold text-foreground">Add AMP to your home screen</p>
        {deferred ? (
          <>
            <p className="text-xs text-muted-foreground">Open it like an app, full screen, with one tap.</p>
            <Button
              size="sm"
              onClick={async () => {
                await deferred.prompt()
                const { outcome } = await deferred.userChoice
                if (outcome === 'accepted') setHidden(true)
                setDeferred(null)
              }}
            >
              <Download aria-hidden="true" /> Install app
            </Button>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tap <Share className="inline size-3.5 align-text-bottom" aria-label="Share" /> in Safari, then{' '}
            <span className="font-medium text-foreground">Add to Home Screen</span>.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </Card>
  )
}
