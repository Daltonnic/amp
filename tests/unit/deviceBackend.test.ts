import { beforeEach, describe, expect, it } from 'vitest'
import { CloudOnlyError } from '@/data/backend'
import { createDeviceBackend } from '@/data/deviceBackend'

const backend = createDeviceBackend()

const checkIn = (date: string, feeling: string) => ({
  track: 'men' as const,
  date,
  emotions: [feeling],
  custom_emotion: '',
  intensity: null,
  temptation_level: 3,
  stress_level: 5,
  recent_triggers: '',
  spiritual_condition: '',
  honesty_check: '',
  next_step: '',
  body_awareness: '',
  primary_fear: '',
  current_need: '',
  reflection: '',
})

describe('device backend', () => {
  beforeEach(() => localStorage.clear())

  it('inserts rows with ids and timestamps', async () => {
    const row = await backend.table('journal_entries').insert({
      title: 'T',
      content: 'C',
      category: 'free_writing',
      prompt_used: '',
      track: 'men',
    })
    expect(row.id).toMatch(/[0-9a-f-]{36}/)
    expect(row.created_at).toBeTruthy()
    expect(await backend.table('journal_entries').list()).toHaveLength(1)
  })

  it('filters with eq and gte, orders and limits', async () => {
    const t = backend.table('check_ins')
    await t.insert(checkIn('2026-11-10', 'A'))
    await t.insert(checkIn('2026-11-12', 'B'))
    await t.insert(checkIn('2026-11-14', 'C'))
    expect((await t.list({ eq: { date: '2026-11-12' } })).map((r) => r.emotions[0])).toEqual(['B'])
    expect(
      (await t.list({ gte: { date: '2026-11-12' }, orderBy: 'date', ascending: true })).map(
        (r) => r.emotions[0],
      ),
    ).toEqual(['B', 'C'])
    expect((await t.list({ orderBy: 'date', ascending: false, limit: 1 })).map((r) => r.emotions[0])).toEqual(
      ['C'],
    )
  })

  it('updates and removes', async () => {
    const t = backend.table('accountability_contacts')
    const row = await t.insert({ name: 'A', email: '', phone: '', relationship: '' })
    expect((await t.update(row.id, { relationship: 'Pastor' })).relationship).toBe('Pastor')
    await t.remove(row.id)
    expect(await t.list()).toHaveLength(0)
  })

  it('only lists published library articles', async () => {
    localStorage.setItem(
      'amp.device.library_articles',
      JSON.stringify([
        { id: '1', title: 'Live', published: true },
        { id: '2', title: 'Draft', published: false },
      ]),
    )
    expect((await backend.table('library_articles').list()).map((a) => a.title)).toEqual(['Live'])
  })

  it('reports cloud-only features clearly', async () => {
    await expect(backend.streamGroundingGuide([], () => {})).rejects.toBeInstanceOf(CloudOnlyError)
  })

  it('deleteAccount erases every on-device table', async () => {
    await backend.table('check_ins').insert(checkIn('2026-11-10', 'A'))
    localStorage.setItem('amp.theme', 'dark')
    await backend.deleteAccount()
    expect(await backend.table('check_ins').list()).toHaveLength(0)
    expect(localStorage.getItem('amp.theme')).toBe('dark')
  })
})
