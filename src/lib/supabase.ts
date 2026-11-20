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
      // Sign-in is normally a code typed into the app. On the web we also
      // accept the email's sign-in link (e.g. Supabase's default template),
      // which lands back here with the session in the URL. The native apps
      // never receive such links, so they skip the check.
      detectSessionInUrl: !Capacitor.isNativePlatform(),
      storage: Capacitor.isNativePlatform() ? nativeStorage : globalThis.localStorage,
      storageKey: 'amp.auth',
    },
  })
  return client
}
