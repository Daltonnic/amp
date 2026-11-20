import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { BookOpen, ChevronRight, Clock, Search, Star } from 'lucide-react'
import { paths } from '@/app/routes'
import { PullToRefresh } from '@/components/PullToRefresh'
import { BackLink, EmptyState, PageHeader, Screen, SectionLabel, useBack } from '@/components/layout'
import { TapCard } from '@/components/ui/card'
import { Badge, Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import { Input } from '@/components/ui/input'
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_ORDER } from '@/content/library'
import { useLibrary } from '@/data/queries'
import type { LibraryArticle, LibraryCategory } from '@/data/types'
import { cn } from '@/lib/utils'

type TrackFilter = 'both' | 'men' | 'spouse'

export default function Library() {
  const [params, setParams] = useSearchParams()
  const library = useLibrary()
  const back = useBack(paths.library)
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState<TrackFilter>('both')
  const [category, setCategory] = useState<LibraryCategory | null>(null)
  const articles = useMemo(() => library.data ?? [], [library.data])

  const articleId = params.get('article')
  const inTrack = (a: LibraryArticle) => track === 'both' || a.track === track || a.track === 'both'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter((a) => {
      if (!inTrack(a)) return false
      if (category && a.category !== category) return false
      if (!q) return true
      return [a.title, a.content, a.tags, a.scripture_reference].some((f) => f?.toLowerCase().includes(q))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, track, category, query])

  const counts = useMemo(() => {
    const result: Partial<Record<LibraryCategory, number>> = {}
    for (const a of articles) if (inTrack(a)) result[a.category] = (result[a.category] ?? 0) + 1
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, track])

  if (articleId) {
    const article = articles.find((a) => a.id === articleId)
    if (!article) {
      return (
        <Screen>
          <BackLink onClick={back} />
          {library.isPending ? (
            <p className="text-sm text-muted-foreground">Loading article...</p>
          ) : (
            <EmptyState>This article could not be found.</EmptyState>
          )}
        </Screen>
      )
    }
    return <ArticleView article={article} onBack={back} />
  }

  const filtering = Boolean(query || category)
  const featured = filtering ? [] : filtered.filter((a) => a.featured).slice(0, 3)
  const open = (a: LibraryArticle) => setParams({ article: a.id })

  return (
    <PullToRefresh onRefresh={() => library.refetch()}>
      <Screen>
        <PageHeader title="Library" subtitle="Teachings, recovery articles, and Scripture." />

        <div className="relative mb-4">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search the library"
            placeholder="Search articles, scripture, topics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs
          value={track}
          onValueChange={(value) => {
            setTrack(value as TrackFilter)
            setCategory(null)
          }}
          className="mb-5"
        >
          <TabsList className="w-full">
            <TabsTrigger value="both" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="men" className="flex-1">
              Men
            </TabsTrigger>
            <TabsTrigger value="spouse" className="flex-1">
              Spouses
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {!query && articles.length > 0 && (
          <div className="scrollbar-hide -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-2">
            <CategoryChip selected={!category} onClick={() => setCategory(null)}>
              All
            </CategoryChip>
            {LIBRARY_CATEGORY_ORDER.filter((c) => (counts[c] ?? 0) > 0).map((c) => (
              <CategoryChip
                key={c}
                selected={category === c}
                onClick={() => setCategory(category === c ? null : c)}
              >
                {LIBRARY_CATEGORIES[c]} ({counts[c]})
              </CategoryChip>
            ))}
          </div>
        )}

        {library.isPending && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}

        {!library.isPending && articles.length === 0 && (
          <EmptyState icon={<BookOpen className="size-10" aria-hidden="true" />} title="No articles yet">
            <span className="text-xs">Articles added by your admin will appear here.</span>
          </EmptyState>
        )}

        {featured.length > 0 && (
          <section className="mb-6">
            <SectionLabel className="font-semibold">Featured</SectionLabel>
            <div className="space-y-2">
              {featured.map((a) => (
                <ArticleCard key={a.id} article={a} featured onClick={() => open(a)} />
              ))}
            </div>
          </section>
        )}

        {!library.isPending &&
          articles.length > 0 &&
          (filtering ? (
            <section>
              <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {filtered.map((a) => (
                  <ArticleCard key={a.id} article={a} onClick={() => open(a)} />
                ))}
                {filtered.length === 0 && <EmptyState>No articles match your search.</EmptyState>}
              </div>
            </section>
          ) : (
            LIBRARY_CATEGORY_ORDER.filter((c) => filtered.some((a) => a.category === c)).map((c) => (
              <section key={c} className="mb-6">
                <SectionLabel className="font-semibold">{LIBRARY_CATEGORIES[c]}</SectionLabel>
                <div className="space-y-2">
                  {filtered
                    .filter((a) => a.category === c)
                    .map((a) => (
                      <ArticleCard key={a.id} article={a} onClick={() => open(a)} />
                    ))}
                </div>
              </section>
            ))
          ))}
      </Screen>
    </PullToRefresh>
  )
}

function CategoryChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ArticleCard({
  article,
  featured,
  onClick,
}: {
  article: LibraryArticle
  featured?: boolean
  onClick: () => void
}) {
  return (
    <TapCard className={cn('p-4', featured && 'border-primary/30 bg-primary/5')} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{LIBRARY_CATEGORIES[article.category] ?? article.category}</Badge>
            {article.track !== 'both' && (
              <Badge variant="outline" className="capitalize">
                {article.track}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium leading-snug text-foreground">{article.title}</p>
          {article.scripture_reference && (
            <p className="mt-0.5 text-xs italic text-primary">{article.scripture_reference}</p>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            {article.read_time_minutes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" aria-hidden="true" /> {article.read_time_minutes} min
              </span>
            )}
            {featured && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Star className="size-3" aria-hidden="true" /> Featured
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </TapCard>
  )
}

function ArticleView({ article, onBack }: { article: LibraryArticle; onBack: () => void }) {
  return (
    <Screen>
      <BackLink onClick={onBack} />
      <article className="animate-in fade-in slide-in-from-bottom-2">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{LIBRARY_CATEGORIES[article.category] ?? article.category}</Badge>
          {article.track !== 'both' && (
            <Badge variant="outline" className="capitalize">
              {article.track}
            </Badge>
          )}
          {article.featured && (
            <Badge className="border-0 bg-primary/10 text-primary">
              <Star className="mr-1 size-3" aria-hidden="true" /> Featured
            </Badge>
          )}
        </div>
        <h1 className="mb-2 font-display text-2xl font-semibold text-foreground">{article.title}</h1>
        {article.scripture_reference && (
          <p className="mb-1 text-sm font-medium italic text-primary">{article.scripture_reference}</p>
        )}
        {article.read_time_minutes && (
          <p className="mb-6 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" /> {article.read_time_minutes} min read
          </p>
        )}
        <div className="space-y-4">
          {article.content.split('\n\n').map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">
              {paragraph}
            </p>
          ))}
        </div>
        {article.tags && (
          <div className="mt-8 flex flex-wrap gap-1.5">
            {article.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
          </div>
        )}
      </article>
    </Screen>
  )
}
