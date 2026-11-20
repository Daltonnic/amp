import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { format } from 'date-fns'
import { Moon, Pencil, Plus, Save, Sunrise, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { paths } from '@/app/routes'
import { PullToRefresh } from '@/components/PullToRefresh'
import { EmptyState, PageHeader, Screen, SectionLabel, useBack } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, TapCard } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/controls'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/dialog'
import { CATEGORIES, PROMPTS, TEMPLATES, type JournalTemplate } from '@/content/journal'
import {
  useCreateJournalEntry,
  useDeleteJournalEntry,
  useJournal,
  useTrack,
  useUpdateJournalEntry,
} from '@/data/queries'
import type { JournalEntry } from '@/data/types'
import { hapticSuccess } from '@/lib/native'
import { cn, errorMessage } from '@/lib/utils'

const DRAFT_KEY = 'amp.journalDraft'

interface Draft {
  key: string
  title: string
  content: string
}

function loadDraft(key: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
    return draft?.key === key ? draft : null
  } catch {
    return null
  }
}

function saveDraft(draft: Draft | null) {
  try {
    if (draft && (draft.title || draft.content)) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* storage unavailable */
  }
}

export default function Journal() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') ?? 'list'
  const category = params.get('category')
  const entryId = params.get('entryId')
  const templateId = params.get('templateId')
  const prompt = params.get('prompt') ?? ''
  const journal = useJournal()
  const back = useBack(paths.journal)

  const entry = entryId ? (journal.data?.find((e) => e.id === entryId) ?? null) : null

  if (view === 'write') {
    if (entryId && journal.isPending) return <EntrySkeleton />
    return (
      <WriteEntry
        category={category ?? 'free_writing'}
        prompt={prompt}
        editing={entry}
        onDone={() => setParams({}, { replace: true })}
        onBack={back}
      />
    )
  }
  if (view === 'entry' && entryId) {
    if (journal.isPending) return <EntrySkeleton />
    if (!entry) {
      return (
        <Screen>
          <PageHeader title="Journal Entry" onBack={back} />
          <EmptyState>This entry could not be found.</EmptyState>
        </Screen>
      )
    }
    return <EntryView entry={entry} onBack={back} />
  }
  if (view === 'category' && category) return <CategoryPrompts category={category} onBack={back} />
  if (view === 'template' && templateId && TEMPLATES[templateId]) {
    return <TemplatePrompts template={TEMPLATES[templateId]} onBack={back} />
  }
  return <JournalList />
}

function useStartWriting() {
  const [, setParams] = useSearchParams()
  return (category: string, prompt = '') =>
    setParams(prompt ? { view: 'write', category, prompt } : { view: 'write', category })
}

function JournalList() {
  const [, setParams] = useSearchParams()
  const track = useTrack()
  const journal = useJournal()
  const startWriting = useStartWriting()
  const entries = journal.data ?? []

  return (
    <PullToRefresh onRefresh={() => journal.refetch()}>
      <Screen>
        <PageHeader
          title="Journal"
          subtitle="A safe space to process honestly."
          action={
            <Button size="sm" onClick={() => startWriting('free_writing')}>
              <Plus aria-hidden="true" /> New
            </Button>
          }
        />

        <section className="mb-5 space-y-2">
          <SectionLabel>Daily Templates</SectionLabel>
          {Object.values(TEMPLATES).map((template) => (
            <TemplateButton
              key={template.id}
              template={template}
              onSelect={() => setParams({ view: 'template', templateId: template.id })}
            />
          ))}
        </section>

        <section className="mb-6">
          <SectionLabel>Guided Prompts</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES[track]
              .filter((c) => c.value !== 'free_writing')
              .map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setParams({ view: 'category', category: c.value })}
                  className="inline-flex min-h-11 items-center rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {c.label}
                </button>
              ))}
          </div>
        </section>

        <SectionLabel>Past Entries</SectionLabel>
        {journal.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState>Your journal is waiting. Start writing when you're ready.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="animate-in fade-in slide-in-from-bottom-1">
                <TapCard
                  className="p-4"
                  onClick={() =>
                    !entry.id.startsWith('temp-') && setParams({ view: 'entry', entryId: entry.id })
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {entry.title || 'Untitled'}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{entry.content}</p>
                    </div>
                    <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), 'MMM d')}
                    </span>
                  </div>
                </TapCard>
              </li>
            ))}
          </ul>
        )}
      </Screen>
    </PullToRefresh>
  )
}

function TemplateButton({ template, onSelect }: { template: JournalTemplate; onSelect: () => void }) {
  const evening = template.icon === 'moon'
  const Icon = evening ? Moon : Sunrise
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98]',
        evening
          ? 'border-indigo-500/20 bg-indigo-500/[0.08] hover:bg-indigo-500/[0.12]'
          : 'border-amber-500/20 bg-amber-500/[0.08] hover:bg-amber-500/[0.12]',
      )}
    >
      <span className={cn('rounded-lg p-2', evening ? 'bg-indigo-500/15' : 'bg-amber-500/15')}>
        <Icon className={cn('size-4', evening ? 'text-indigo-500' : 'text-amber-600')} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{template.label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{template.description}</span>
      </span>
    </button>
  )
}

function PromptList({ prompts, category }: { prompts: string[]; category: string }) {
  const startWriting = useStartWriting()
  return (
    <div className="space-y-3">
      {prompts.map((prompt) => (
        <TapCard key={prompt} className="p-4" onClick={() => startWriting(category, prompt)}>
          <p className="text-sm text-foreground">{prompt}</p>
        </TapCard>
      ))}
      <TapCard className="border-dashed p-4" onClick={() => startWriting(category)}>
        <p className="text-sm text-muted-foreground">Write freely without a prompt</p>
      </TapCard>
    </div>
  )
}

function CategoryPrompts({ category, onBack }: { category: string; onBack: () => void }) {
  const track = useTrack()
  const label = CATEGORIES[track].find((c) => c.value === category)?.label ?? 'Journal'
  return (
    <Screen>
      <PageHeader title={label} onBack={onBack} />
      <PromptList prompts={PROMPTS[track][category] ?? []} category={category} />
    </Screen>
  )
}

function TemplatePrompts({ template, onBack }: { template: JournalTemplate; onBack: () => void }) {
  return (
    <Screen>
      <PageHeader title={template.label} subtitle={template.description} onBack={onBack} />
      <PromptList prompts={template.prompts} category={template.category} />
    </Screen>
  )
}

function WriteEntry({
  category,
  prompt,
  editing,
  onDone,
  onBack,
}: {
  category: string
  prompt: string
  editing: JournalEntry | null
  onDone: () => void
  onBack: () => void
}) {
  const track = useTrack()
  const create = useCreateJournalEntry()
  const update = useUpdateJournalEntry()
  const draftKey = editing ? `edit:${editing.id}` : `new:${category}:${prompt}`
  const initial = useMemo(
    () =>
      loadDraft(draftKey) ?? { key: draftKey, title: editing?.title ?? '', content: editing?.content ?? '' },
    [draftKey, editing],
  )
  const [title, setTitle] = useState(initial.title)
  const [content, setContent] = useState(initial.content)
  const restored = useRef(Boolean(loadDraft(draftKey)))

  useEffect(() => {
    if (restored.current) toast('Restored your unsaved draft.')
  }, [])

  useEffect(() => {
    const unchanged = editing && title === editing.title && content === editing.content
    const id = setTimeout(() => saveDraft(unchanged ? null : { key: draftKey, title, content }), 400)
    return () => clearTimeout(id)
  }, [draftKey, title, content, editing])

  const pending = create.isPending || update.isPending
  const shownPrompt = editing?.prompt_used || prompt

  const save = async () => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: { title: title.trim(), content } })
        toast.success('Entry updated.')
      } else {
        await create.mutateAsync({
          title: title.trim(),
          content,
          category,
          prompt_used: prompt,
          track,
        })
        toast.success('Entry saved.')
      }
      saveDraft(null)
      hapticSuccess()
      onDone()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Screen>
      <PageHeader title={editing ? 'Edit Entry' : 'New Entry'} onBack={onBack} />
      {shownPrompt && (
        <Card className="mb-4 border-primary/10 bg-primary/5 p-4">
          <p className="text-sm italic text-primary">"{shownPrompt}"</p>
        </Card>
      )}
      <Input
        aria-label="Title (optional)"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        className="mb-3 border-none bg-transparent px-0 text-lg font-medium shadow-none focus-visible:ring-0"
      />
      <Textarea
        aria-label="Journal entry"
        placeholder="Write freely..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus={!editing}
        className="min-h-[300px] resize-none border-none bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
      />
      <Button onClick={() => void save()} disabled={!content.trim() || pending} className="mt-4 w-full">
        <Save aria-hidden="true" /> {pending ? 'Saving...' : editing ? 'Save Changes' : 'Save Entry'}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Drafts are kept on this device until you save.
      </p>
    </Screen>
  )
}

function EntryView({ entry, onBack }: { entry: JournalEntry; onBack: () => void }) {
  const [, setParams] = useSearchParams()
  const remove = useDeleteJournalEntry()
  return (
    <Screen>
      <PageHeader title={entry.title || 'Journal Entry'} onBack={onBack} />
      <p className="-mt-4 mb-4 text-xs text-muted-foreground">
        {format(new Date(entry.created_at), 'MMMM d, yyyy')}
      </p>
      {entry.prompt_used && <p className="mb-4 text-sm italic text-primary">"{entry.prompt_used}"</p>}
      <p className="whitespace-pre-wrap leading-relaxed text-foreground">{entry.content}</p>
      <div className="mt-8 flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setParams({ view: 'write', entryId: entry.id, category: entry.category })}
        >
          <Pencil className="size-3.5" aria-hidden="true" /> Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="size-3.5" aria-hidden="true" /> Delete Entry
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes it from your journal.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                destructive
                onClick={() => {
                  remove.mutate(entry.id)
                  setParams({}, { replace: true })
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Screen>
  )
}

function EntrySkeleton() {
  return (
    <Screen>
      <Skeleton className="mb-4 h-7 w-48" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </Screen>
  )
}
