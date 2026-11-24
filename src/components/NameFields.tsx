import { useId } from 'react'
import { Label } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { MAX_NICKNAME, NAME_STYLES, publicName, type NameParts } from '@/lib/names'
import { cn } from '@/lib/utils'

/**
 * First name, last name and "Show my name as". Used when joining the group
 * and in Settings, so people can always see exactly what others will see.
 */
export function NameFields({ value, onChange }: { value: NameParts; onChange: (next: NameParts) => void }) {
  const id = useId()
  const set = (patch: Partial<NameParts>) => onChange({ ...value, ...patch })
  const shown = publicName(value)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-first`} className="text-xs text-muted-foreground">
            First name
          </Label>
          <Input
            id={`${id}-first`}
            value={value.first}
            onChange={(e) => set({ first: e.target.value })}
            maxLength={80}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-last`} className="text-xs text-muted-foreground">
            Last name <span className="font-normal">(optional)</span>
          </Label>
          <Input
            id={`${id}-last`}
            value={value.last}
            onChange={(e) => set({ last: e.target.value })}
            maxLength={80}
            autoComplete="family-name"
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs text-muted-foreground">Show my name to others as</legend>
        {NAME_STYLES.map((style) => {
          const example = style.value === 'nickname' ? '' : publicName({ ...value, style: style.value })
          const checked = value.style === style.value
          return (
            <label
              key={style.value}
              className={cn(
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
              )}
            >
              <input
                type="radio"
                name={`${id}-style`}
                value={style.value}
                checked={checked}
                onChange={() => set({ style: style.value })}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{style.label}</span>
                {style.hint && <span className="block text-xs text-muted-foreground">{style.hint}</span>}
              </span>
              {example && <span className="shrink-0 text-sm text-muted-foreground">{example}</span>}
            </label>
          )
        })}
      </fieldset>

      {value.style === 'nickname' && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-nickname`} className="text-xs text-muted-foreground">
            Nickname
          </Label>
          <Input
            id={`${id}-nickname`}
            value={value.nickname}
            onChange={(e) => set({ nickname: e.target.value })}
            maxLength={MAX_NICKNAME}
            placeholder="e.g. Steady Walker"
            autoComplete="nickname"
          />
        </div>
      )}

      <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground" aria-live="polite">
        Others will see:{' '}
        <strong className="font-semibold text-foreground">{shown || 'add your name above'}</strong>
      </p>
    </div>
  )
}

/** Name parts as stored on the profile. */
export function namePartsOf(p: {
  display_name: string
  last_name?: string | null
  name_display?: NameParts['style'] | null
  nickname?: string | null
}): NameParts {
  return {
    first: p.display_name,
    last: p.last_name ?? '',
    style: p.name_display ?? 'first_last_initial',
    nickname: p.nickname ?? '',
  }
}

/** The profile columns for a set of name parts. */
export function profileNamePatch(parts: NameParts) {
  return {
    display_name: parts.first.trim(),
    last_name: parts.last.trim(),
    name_display: parts.style,
    nickname: parts.nickname.trim(),
  }
}
