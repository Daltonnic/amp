import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePush } from '@/data/pushQueries'
import { requestPushPermission } from '@/lib/push'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

const DISMISS_KEY = 'amp.pushPromptDismissed'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** One-tap "Turn on notifications" on Home, until it's on (or dismissed on this device). */
export function NotificationsPrompt() {
  const push = usePush()
  const [dismissed, setDismissed] = useState(wasDismissed)
  if (dismissed || !push.available || push.state !== 'off') return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  const turnOn = () =>
    push.enable.mutate(requestPushPermission(), {
      onSuccess: (state) => {
        if (state === 'on') {
          hapticSuccess()
          toast.success('Notifications are on. You’ll hear from your group even when AMP is closed.')
        } else if (state === 'blocked') {
          toast.error('Notifications are blocked for AMP. You can allow them in your settings.')
        }
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <Card className="relative border-primary/20 bg-primary/5 p-5 pr-12">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-foreground">Get notified when your group posts</h2>
          <p className="text-sm text-muted-foreground">
            You’ll get a notification even when AMP is closed. It stays private: just “New message in your
            group”, never the message itself unless you choose.
          </p>
        </div>
      </div>
      <Button className="mt-4 w-full" onClick={turnOn} disabled={push.busy}>
        <Bell aria-hidden="true" /> {push.busy ? 'Turning on…' : 'Turn on notifications'}
      </Button>
    </Card>
  )
}
