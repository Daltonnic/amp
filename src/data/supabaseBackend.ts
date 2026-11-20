import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import type { Backend, ListQuery, TableApi } from './backend'
import { RateLimitedError } from './backend'
import type { ChatMessage, Insert, Patch, TableName, Tables } from './types'

function supabaseTable<K extends TableName>(sb: SupabaseClient, name: K): TableApi<Tables[K]> {
  type Row = Tables[K]
  // The schema is described by our own row types (src/data/types.ts) rather
  // than generated Supabase types, so the query builder is used untyped here.
  const table = () => sb.from(name as string)
  return {
    async list(query: ListQuery<Row> = {}) {
      let q = table().select('*')
      for (const [col, value] of Object.entries(query.eq ?? {})) q = q.eq(col, value)
      for (const [col, value] of Object.entries(query.gte ?? {})) q = q.gte(col, value)
      if (query.orderBy) q = q.order(query.orderBy, { ascending: query.ascending ?? false })
      if (query.limit) q = q.limit(query.limit)
      const { data, error } = await q
      if (error) throw error
      return data as Row[]
    },
    async insert(input: Insert<Row>) {
      const { data, error } = await table()
        .insert(input as Record<string, unknown>)
        .select()
        .single()
      if (error) throw error
      return data as Row
    },
    async update(id: string, patch: Patch<Row>) {
      const { data, error } = await table()
        .update(patch as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Row
    },
    async remove(id: string) {
      const { error } = await table().delete().eq('id', id)
      if (error) throw error
    },
  }
}

async function unwrapFunctionError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    let message = 'Something went wrong. Please try again.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 429) throw new RateLimitedError(message)
    throw new Error(message)
  }
  throw error
}

export function createSupabaseBackend(sb: SupabaseClient): Backend {
  return {
    mode: 'cloud',

    table: (name) => supabaseTable(sb, name),

    async streamGroundingGuide(messages: ChatMessage[], onText, signal) {
      const { data } = await sb.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Please sign in again.')
      const res = await fetch(`${config.supabaseUrl}/functions/v1/grounding-guide`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: config.supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
        signal,
      })
      if (!res.ok || !res.body) {
        let message = 'The Grounding Guide is unavailable right now.'
        try {
          const body = (await res.json()) as { error?: string }
          if (body.error) message = body.error
        } catch {
          /* ignore */
        }
        if (res.status === 429) throw new RateLimitedError(message)
        throw new Error(message)
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) onText(value)
      }
    },

    async deleteAccount() {
      const { error } = await sb.functions.invoke('delete-account', { body: {} })
      if (error) await unwrapFunctionError(error)
      await sb.auth.signOut({ scope: 'local' })
    },
  }
}
