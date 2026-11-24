import { useSearchParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { paths } from '@/app/routes'
import { BackLink, Screen, useBack } from '@/components/layout'
import { TapCard } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import { RESOURCES } from '@/content/resources'
import { useProfile, useTrack } from '@/data/queries'
import type { Track } from '@/data/types'
import { recoveryTabLabel } from '@/lib/audience'

export default function Resources() {
  const [params, setParams] = useSearchParams()
  const userTrack = useTrack()
  const recoveryLabel = recoveryTabLabel(useProfile().data)
  const back = useBack(paths.resources)

  // The selected tab lives in the URL so it survives opening an article.
  const tab: Track =
    params.get('track') === 'spouse' ? 'spouse' : params.get('track') === 'men' ? 'men' : userTrack
  const categories = RESOURCES[tab]
  const categoryIndex = params.get('category')
  const articleIndex = params.get('article')
  const category = categoryIndex !== null ? categories[Number(categoryIndex)] : undefined
  const article = category && articleIndex !== null ? category.items[Number(articleIndex)] : undefined

  if (category && article) {
    return (
      <Screen>
        <BackLink onClick={back} />
        <article className="animate-in fade-in slide-in-from-bottom-2">
          <h1 className="mb-4 font-display text-xl font-semibold text-foreground">{article.title}</h1>
          {article.content.split('\n\n').map((paragraph, i) => (
            <p key={i} className="mb-4 whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">
              {paragraph}
            </p>
          ))}
        </article>
      </Screen>
    )
  }

  if (category) {
    return (
      <Screen>
        <BackLink onClick={back} />
        <h1 className="mb-4 font-display text-lg font-semibold text-foreground">{category.category}</h1>
        <div className="space-y-3">
          {category.items.map((item, i) => (
            <TapCard
              key={item.title}
              className="flex items-center justify-between p-4"
              onClick={() => setParams({ track: tab, category: String(categoryIndex), article: String(i) })}
            >
              <span className="text-sm font-medium text-foreground">{item.title}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </TapCard>
          ))}
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <h1 className="mb-1 font-display text-xl font-semibold text-foreground">Resources</h1>
      <p className="mb-4 text-sm text-muted-foreground">Practical. Readable. Rooted in truth.</p>
      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ track: value }, { replace: true })}
        className="mb-6"
      >
        <TabsList className="w-full">
          <TabsTrigger value="men" className="flex-1">
            {recoveryLabel}
          </TabsTrigger>
          <TabsTrigger value="spouse" className="flex-1">
            Spouses
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="space-y-3">
        {categories.map((c, i) => (
          <TapCard
            key={c.category}
            className="flex items-center justify-between p-5"
            onClick={() => setParams({ track: tab, category: String(i) })}
          >
            <span>
              <span className="block font-semibold text-foreground">{c.category}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{c.items.length} articles</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </TapCard>
        ))}
      </div>
    </Screen>
  )
}
