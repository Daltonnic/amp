import { useSearchParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { paths } from '@/app/routes'
import { BackLink, Screen, useBack } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, TapCard } from '@/components/ui/card'
import { IDENTITY_SECTIONS } from '@/content/identity'

export default function IdentityFormation() {
  const [params, setParams] = useSearchParams()
  const back = useBack(paths.identity)

  const sectionIndex = params.get('section')
  const itemIndex = params.get('item')
  const section = sectionIndex !== null ? IDENTITY_SECTIONS[Number(sectionIndex)] : undefined
  const item = section && itemIndex !== null ? section.items[Number(itemIndex)] : undefined

  if (section && item) {
    const i = Number(itemIndex)
    const hasNext = i < section.items.length - 1
    return (
      <Screen>
        <BackLink onClick={back} />
        <div key={i} className="animate-in fade-in slide-in-from-bottom-2">
          <Card className="space-y-4 border-primary/10 bg-primary/5 p-8 text-center">
            <p className="font-display text-xl font-semibold leading-relaxed text-foreground">{item.truth}</p>
            <p className="text-sm font-medium text-primary">{item.scripture}</p>
          </Card>
          <Card className="mt-6 p-5">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Reflection</p>
            <p className="leading-relaxed text-foreground">{item.reflection}</p>
          </Card>
          <div className="mt-6 flex gap-3">
            {hasNext && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  setParams({ section: String(sectionIndex), item: String(i + 1) }, { replace: true })
                }
              >
                Next <ChevronRight aria-hidden="true" />
              </Button>
            )}
            <Button className="flex-1" onClick={back}>
              Done
            </Button>
          </div>
        </div>
      </Screen>
    )
  }

  if (section) {
    return (
      <Screen>
        <BackLink onClick={back} />
        <h1 className="mb-4 font-display text-lg font-semibold text-foreground">{section.title}</h1>
        <div className="space-y-3">
          {section.items.map((it, i) => (
            <TapCard
              key={it.truth}
              className="min-h-16 p-4"
              onClick={() => setParams({ section: String(sectionIndex), item: String(i) })}
            >
              <p className="text-sm font-medium text-foreground">{it.truth}</p>
              <p className="mt-1 text-xs text-primary">{it.scripture}</p>
            </TapCard>
          ))}
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <h1 className="mb-1 font-display text-xl font-semibold text-foreground">Identity & Scripture</h1>
      <p className="mb-6 text-sm text-muted-foreground">Rooted in who you are. Grounded in truth.</p>
      <div className="space-y-3">
        {IDENTITY_SECTIONS.map((s, i) => (
          <TapCard
            key={s.title}
            className="flex min-h-16 items-center justify-between p-5"
            onClick={() => setParams({ section: String(i) })}
          >
            <span>
              <span className="block font-semibold text-foreground">{s.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{s.items.length} truths</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </TapCard>
        ))}
      </div>
    </Screen>
  )
}
