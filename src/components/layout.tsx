import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Standard page column: phone-width content with comfortable gutters. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-lg px-5 pb-6 pt-6', className)}>{children}</div>
}

/**
 * Back navigation that behaves like a native app: go back if there is
 * in-app history, otherwise replace with `fallback` (e.g. after a deep link).
 */
export function useBack(fallback: string) {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  action,
  as: Heading = 'h1',
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  action?: ReactNode
  as?: 'h1' | 'h2'
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="-ml-3 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        )}
        <div className={cn('min-w-0', onBack && 'pt-2')}>
          <Heading className="font-display text-xl font-semibold text-foreground">{title}</Heading>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function BackLink({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground', className)}>
      {children}
    </p>
  )
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode
  title?: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-2 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex justify-center text-muted-foreground">{icon}</div>}
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}
