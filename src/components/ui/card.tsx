import { forwardRef, type HTMLAttributes, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-xl border bg-card text-card-foreground shadow-xs', className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

interface TapCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  onClick: () => void
  selected?: boolean
  disabled?: boolean
}

/** A card that behaves as a button (keyboard + screen-reader accessible). */
export const TapCard = forwardRef<HTMLDivElement, TapCardProps>(
  ({ className, onClick, selected, disabled, ...props }, ref) => {
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    }
    return (
      <Card
        ref={ref}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={selected}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onClick}
        onKeyDown={onKeyDown}
        className={cn(
          'cursor-pointer select-none transition-[background-color,border-color,transform] hover:bg-muted/50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'cursor-not-allowed opacity-50 active:scale-100',
          className,
        )}
        {...props}
      />
    )
  },
)
TapCard.displayName = 'TapCard'
