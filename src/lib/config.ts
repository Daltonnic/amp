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
  /**
   * Web Push public key (VAPID). Public by design: browsers need it to
   * subscribe. Its private half is the VAPID_PRIVATE_KEY function secret.
   */
  vapidPublicKey:
    (env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ||
    'BHmIwO20AG52BDVjs_Y03nIsxT8BVD-gufeaiKUdpD1zUcrcaybjK_YSzbxFsOOb41x2yvmwV3L3FDyGowacl6Y',
  /**
   * Push in the store apps needs Firebase (Android) and an Apple push key
   * (iPhone) to be set up first; see docs/PUSH_NOTIFICATIONS.md. Until then
   * the native apps don't offer push.
   */
  nativePush: (env.VITE_NATIVE_PUSH as string | undefined) === 'true',
} as const

/** True when a Supabase project is configured; otherwise the app runs in on-device mode. */
export const isCloudConfigured = Boolean(config.supabaseUrl && config.supabaseKey)
