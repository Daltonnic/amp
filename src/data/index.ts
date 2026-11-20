import { isCloudConfigured } from '@/lib/config'
import { getSupabase } from '@/lib/supabase'
import type { Backend } from './backend'
import { createDeviceBackend } from './deviceBackend'
import { createSupabaseBackend } from './supabaseBackend'

export const backend: Backend = isCloudConfigured
  ? createSupabaseBackend(getSupabase())
  : createDeviceBackend()

export * from './backend'
export type * from './types'
