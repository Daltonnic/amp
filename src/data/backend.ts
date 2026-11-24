import type { Insert, Patch, TableName, Tables } from './types'

export interface ListQuery<T> {
  orderBy?: keyof T & string
  ascending?: boolean
  limit?: number
  /** Equality filters. */
  eq?: Partial<{ [K in keyof T & string]: T[K] }>
  /** Greater-than-or-equal filters (dates compare as ISO strings). */
  gte?: Partial<{ [K in keyof T & string]: T[K] }>
}

export interface TableApi<T> {
  list(query?: ListQuery<T>): Promise<T[]>
  insert(input: Insert<T>): Promise<T>
  update(id: string, patch: Patch<T>): Promise<T>
  remove(id: string): Promise<void>
}

export interface Backend {
  /**
   * `cloud`: Supabase (production). `device`: everything stays in this
   * browser/device — used for local development, previews and tests.
   */
  readonly mode: 'cloud' | 'device'
  table<K extends TableName>(name: K): TableApi<Tables[K]>
  /** Permanently deletes the account and every row that belongs to it. */
  deleteAccount(): Promise<void>
}

/** The server refused because the user hit a rate limit. */
export class RateLimitedError extends Error {
  constructor(message = 'Too many requests. Please wait a little and try again.') {
    super(message)
    this.name = 'RateLimitedError'
  }
}
