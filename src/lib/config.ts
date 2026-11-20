/** Build-time configuration (see .env.example). */

const env = import.meta.env

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined)?.trim() || '',
  supabaseKey:
    (env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    (env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    '',
  supportEmail: (env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || '',
  /** Public web origin of the PWA, used for links shown inside the native apps. */
  webUrl: (env.VITE_PUBLIC_WEB_URL as string | undefined)?.trim() || '',
  appVersion: (env.VITE_APP_VERSION as string | undefined) || '1.0.0',
} as const

/** True when a Supabase project is configured; otherwise the app runs in on-device mode. */
export const isCloudConfigured = Boolean(config.supabaseUrl && config.supabaseKey)
