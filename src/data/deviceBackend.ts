import type { Backend, ListQuery, TableApi } from './backend'
import { CloudOnlyError } from './backend'
import type { Insert, Patch, TableName, Tables } from './types'

/**
 * On-device backend: rows live in localStorage. Used when no Supabase project
 * is configured (local development, previews, automated tests). Nothing
 * leaves the device in this mode.
 */

export const DEVICE_USER_ID = '00000000-0000-4000-8000-000000000000'
const PREFIX = 'amp.device.'

function read<T>(name: TableName): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function write<T>(name: TableName, rows: T[]) {
  localStorage.setItem(PREFIX + name, JSON.stringify(rows))
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  return a < b ? -1 : 1
}

function deviceTable<K extends TableName>(name: K): TableApi<Tables[K]> {
  type Row = Tables[K]
  return {
    async list(query: ListQuery<Row> = {}) {
      let rows = read<Row>(name)
      for (const [col, value] of Object.entries(query.eq ?? {})) {
        rows = rows.filter((r) => (r as unknown as Record<string, unknown>)[col] === value)
      }
      for (const [col, value] of Object.entries(query.gte ?? {})) {
        rows = rows.filter((r) => compare((r as unknown as Record<string, unknown>)[col], value) >= 0)
      }
      if (name === 'library_articles') {
        rows = rows.filter((r) => (r as Tables['library_articles']).published)
      }
      if (query.orderBy) {
        const col = query.orderBy
        const dir = query.ascending ? 1 : -1
        rows = [...rows].sort((a, b) => dir * compare(a[col], b[col]))
      }
      return query.limit ? rows.slice(0, query.limit) : rows
    },
    async insert(input: Insert<Row>) {
      const now = new Date().toISOString()
      const row = {
        id: crypto.randomUUID(),
        user_id: DEVICE_USER_ID,
        created_at: now,
        updated_at: now,
        ...input,
      } as unknown as Row
      write(name, [...read<Row>(name), row])
      return row
    },
    async update(id: string, patch: Patch<Row>) {
      const rows = read<Row>(name)
      const index = rows.findIndex((r) => (r as { id: string }).id === id)
      if (index < 0) throw new Error('Not found')
      const updated = { ...rows[index], ...patch, updated_at: new Date().toISOString() } as Row
      rows[index] = updated
      write(name, rows)
      return updated
    },
    async remove(id: string) {
      write(
        name,
        read<Row>(name).filter((r) => (r as { id: string }).id !== id),
      )
    },
  }
}

export function createDeviceBackend(): Backend {
  return {
    mode: 'device',
    table: (name) => deviceTable(name),
    async streamGroundingGuide() {
      throw new CloudOnlyError('The Grounding Guide')
    },
    async deleteAccount() {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) localStorage.removeItem(key)
      }
    },
  }
}
