import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import Markdown from 'react-markdown'
import { LoaderCircle, Send, X } from 'lucide-react'
import { paths } from '@/app/routes'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { backend, CloudOnlyError, RateLimitedError } from '@/data'
import { useLogGroundingSession } from '@/data/queries'
import type { ChatMessage, TriggerLog } from '@/data/types'
import { TRIGGER_TYPES } from '@/content/triggers'
import { errorMessage } from '@/lib/utils'

type Seed = Pick<TriggerLog, 'emotional_state' | 'trigger_type' | 'intensity'> &
  Partial<Pick<TriggerLog, 'event_description' | 'thoughts' | 'physical_sensations'>>

/** The opening message sent on the user's behalf (not shown in the chat). */
export function openingMessage(log: Seed | null): string {
  if (!log) return 'I just experienced a trigger and need help grounding.'
  const type = TRIGGER_TYPES.find((t) => t.value === log.trigger_type)?.label ?? log.trigger_type
  return [
    "I just logged a trigger and need help grounding. Here's what I recorded:",
    `- Emotional state: ${log.emotional_state}`,
    `- Trigger type: ${type}`,
    log.intensity ? `- Intensity: ${log.intensity}/10` : null,
    log.event_description ? `- What happened: ${log.event_description}` : null,
    log.thoughts ? `- My thoughts: ${log.thoughts}` : null,
    log.physical_sensations ? `- Physical sensations: ${log.physical_sensations}` : null,
    'Please help me ground right now.',
  ]
    .filter(Boolean)
    .join('\n')
}

const CONSENT_KEY = 'amp.aiConsent'

/** Whether the person has agreed to send Grounding Guide messages to the AI provider. */
export function hasAiConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

function grantAiConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1')
  } catch {
    /* storage unavailable: they'll simply be asked again next time */
  }
}

/**
 * One-time disclosure before anything is sent to the AI provider
 * (App Store Review Guideline 5.1.2: explicit permission before sharing
 * personal data with third-party AI).
 */
export function AiConsentDialog({
  open,
  onOpenChange,
  onAccept,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>Before you start</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-2">
            <p>
              The Grounding Guide is an AI. To reply, it sends the trigger you logged and the messages you
              write to our AI provider, Anthropic. Conversations are not saved by AMP.
            </p>
            <p>
              It isn't a counselor. If you're in danger, call or text 988 (U.S.) or your local emergency
              number.
            </p>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              grantAiConsent()
              onAccept()
            }}
          >
            I agree, continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type Status = 'streaming' | 'idle' | { error: string; kind: 'unavailable' | 'limit' | 'other' }

/**
 * AI-led grounding conversation (replaces the Base44 `grounding_guide`
 * agent). The conversation lives only in memory on this device; the server
 * does not store it.
 */
export function GroundingGuide({ triggerLog, onClose }: { triggerLog: Seed | null; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: 'user', content: openingMessage(triggerLog) },
    { role: 'assistant', content: '' },
  ])
  const [status, setStatus] = useState<Status>('streaming')
  const [input, setInput] = useState('')
  const abort = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const logged = useRef(false)
  const logSession = useLogGroundingSession()

  /** Streams a reply to `history`. State updates happen only in async callbacks. */
  const stream = useCallback(async (history: ChatMessage[]) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    try {
      await backend.streamGroundingGuide(
        history,
        (chunk) =>
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]!
            next[next.length - 1] = { ...last, content: last.content + chunk }
            return next
          }),
        controller.signal,
      )
      setStatus('idle')
    } catch (err) {
      if (controller.signal.aborted) return
      setMessages(history) // drop the empty/partial reply
      if (err instanceof CloudOnlyError) setStatus({ error: err.message, kind: 'unavailable' })
      else if (err instanceof RateLimitedError) setStatus({ error: err.message, kind: 'limit' })
      else setStatus({ error: errorMessage(err), kind: 'other' })
    }
  }, [])

  const run = (history: ChatMessage[]) => {
    setStatus('streaming')
    setMessages([...history, { role: 'assistant', content: '' }])
    void stream(history)
  }

  // Start the session on open; abort any in-flight reply on close.
  useEffect(() => {
    if (!logged.current) {
      logged.current = true
      logSession.mutate('guide')
    }
    // `stream` only sets state after awaiting the network (an external
    // system), never synchronously; the lint rule can't see the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void stream([{ role: 'user', content: openingMessage(triggerLog) }])
    return () => abort.current?.abort()
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, status])

  // Lock background scrolling while the guide is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const send = () => {
    const text = input.trim()
    if (!text || status === 'streaming') return
    setInput('')
    run([...messages.filter((m) => m.content), { role: 'user', content: text }])
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const visible = messages.slice(1)
  const streaming = status === 'streaming'
  const waitingForFirstToken = streaming && !visible.at(-1)?.content

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex items-center justify-between border-b bg-card px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <div>
          <h2 id="guide-title" className="font-semibold text-foreground">
            Grounding Guide
          </h2>
          <p className="text-xs text-muted-foreground">AI-led grounding session</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close grounding guide"
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto max-w-lg space-y-3" aria-live="polite" aria-busy={streaming}>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-center text-[11px] leading-snug text-muted-foreground">
            This guide is AI and can make mistakes. It isn't a counselor. If you're in danger or thinking
            about harming yourself, call or text{' '}
            <a href="tel:988" className="font-semibold underline">
              988
            </a>{' '}
            (U.S.) or your local emergency number.
          </p>
          {visible.map((m, i) => (m.content ? <Bubble key={i} message={m} /> : null))}
          {waitingForFirstToken && (
            <div className="flex items-center gap-2 pl-8 text-xs text-muted-foreground">
              <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
              <span>{visible.length <= 1 ? 'Starting your grounding session...' : 'Responding...'}</span>
            </div>
          )}
          {typeof status === 'object' && (
            <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
              <p className="text-foreground">{status.error}</p>
              <div className="flex flex-wrap gap-2">
                {status.kind === 'other' && (
                  <Button size="sm" onClick={() => run(messages.filter((m) => m.content))}>
                    Try again
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link to={paths.grounding} onClick={onClose}>
                    Open grounding tools
                  </Link>
                </Button>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t bg-card px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3">
        <div className="mx-auto flex max-w-lg items-end gap-2">
          <Textarea
            aria-label="Your message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Respond or share how you're feeling..."
            rows={1}
            maxLength={4000}
            className="max-h-28 min-h-11 resize-none"
            disabled={typeof status === 'object' && status.kind !== 'other'}
          />
          <Button
            size="icon"
            onClick={send}
            aria-label="Send message"
            disabled={!input.trim() || streaming}
            className="shrink-0"
          >
            <Send aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && (
        <div
          className="mr-2 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20"
          aria-hidden="true"
        >
          <div className="size-1.5 rounded-full bg-primary" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? 'bg-primary text-primary-foreground' : 'border bg-card text-foreground'}`}
      >
        {mine ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="space-y-2 [&_li]:ml-4 [&_ol]:list-decimal [&_strong]:font-semibold [&_ul]:list-disc">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  )
}
