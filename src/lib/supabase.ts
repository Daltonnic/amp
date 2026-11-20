import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { config, isCloudConfigured } from './config'

/**
 * On iOS/Android the session lives in native key-value storage
 * (UserDefaults / SharedPreferences) rather than WebView localStorage, which
 * the OS may evict under storage pressure.
 */
const nativeStorage: SupportedStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: async (key, value) => {
    await Preferences.set({ key, value })
  },
  removeItem: async (key) => {
    await Preferences.remove({ key })
  },
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isCloudConfigured) {
    throw new Error('Supabase is not configured (set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY).')
  }
  client ??= createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Sign-in uses one-time codes typed into the app, so there is no
      // redirect URL to parse. This keeps native and web flows identical.
      detectSessionInUrl: false,
      storage: Capacitor.isNativePlatform() ? nativeStorage : globalThis.localStorage,
      storageKey: 'amp.auth',
    },
  })
  return client
}
