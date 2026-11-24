import type { ReactNode } from 'react'
import { Slider } from '@/components/ui/controls'
import { TapCard } from '@/components/ui/card'
import { hapticTap } from '@/lib/native'
import { cn } from '@/lib/utils'

/** Pill-shaped single-select option, used for emotions, trigger types, etc. */
export function Chip({
  selected,
  onClick,
  children,
  size = 'md',
  className,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        hapticTap()
        onClick()
      }}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 py-1.5 font-medium transition-colors',
        size === 'sm' ? 'text-xs' : 'text-sm',
        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  getLabel = (o) => o,
}: {
  label: string
  options: readonly T[]
  value: string
  onChange: (value: T) => void
  getLabel?: (option: T) => string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option} selected={value === option} onClick={() => onChange(option)}>
            {getLabel(option)}
          </Chip>
        ))}
      </div>
    </fieldset>
  )
}

/** Large selectable card (onboarding track, needs, spiritual condition). */
export function OptionCard({
  selected,
  onClick,
  disabled,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <TapCard
      selected={selected}
      disabled={disabled}
      onClick={() => {
        hapticTap()
        onClick()
      }}
      className={cn(
        'border-2 p-4 hover:bg-card',
        selected ? 'border-primary bg-primary/5 hover:bg-primary/5' : 'border-border hover:border-primary/30',
        className,
      )}
    >
      {children}
    </TapCard>
  )
}

export function IntensitySlider({
  label,
  value,
  onChange,
  lowLabel = 'Low',
  highLabel = 'High',
  min = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  lowLabel?: string
  highLabel?: string
  /** Lowest value; 0 lets someone say "none at all". */
  min?: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold text-primary" aria-hidden="true">
          {value}/10
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => {
          if (v !== undefined && v !== value) {
            hapticTap()
            onChange(v)
          }
        }}
        min={min}
        max={10}
        step={1}
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

/** Segmented progress bar for multi-step flows. */
export function StepProgress({
  total,
  current,
  className,
}: {
  total: number
  current: number
  className?: string
}) {
  return (
    <div
      className={cn('flex gap-1.5', className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors duration-500',
            i <= current ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  )
}
