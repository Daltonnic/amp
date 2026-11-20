/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const APP_NAME = 'Apostolic Moral Purity'

/**
 * Supabase settings may arrive under several names: our own VITE_* names, or
 * the ones Vercel's Supabase integration creates (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_URL, ...ANON_KEY / ...PUBLISHABLE_KEY). Only public values are
 * accepted; a secret or service-role key stops the build.
 */
function resolvePublicSupabaseEnv(mode: string) {
  const all = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const pick = (names: string[]) => names.map((n) => all[n]?.trim()).find(Boolean) ?? ''

  if (process.env.VITE_SUPABASE_URL === undefined) {
    process.env.VITE_SUPABASE_URL = pick(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'])
  }
  if (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY === undefined &&
    process.env.VITE_SUPABASE_ANON_KEY === undefined
  ) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = pick([
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_ANON_KEY',
    ])
  }

  const url = (process.env.VITE_SUPABASE_URL || all.VITE_SUPABASE_URL || '').trim()
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    all.VITE_SUPABASE_PUBLISHABLE_KEY ||
    all.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim()

  if (key && isSecretKey(key)) {
    throw new Error(
      'Refusing to build: the Supabase key given to the app is a secret/service-role key. ' +
        'Use the publishable (anon) key — the secret key must never be shipped to browsers or phones.',
    )
  }
  if (process.env.VERCEL_ENV === 'production' && (!url || !key)) {
    throw new Error(
      'Supabase is not configured for this production build, so the app would not save anything. ' +
        'In Vercel → Settings → Environment Variables, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY ' +
        '(or connect the Supabase integration, which provides NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).',
    )
  }
}

function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: string }
    return claims.role === 'service_role'
  } catch {
    return false
  }
}

export default defineConfig(({ mode }) => {
  resolvePublicSupabaseEnv(mode)
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // The update prompt lives in src/components/UpdatePrompt.tsx so users are
        // never yanked onto a new version mid-journal-entry.
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'theme-init.js', 'brand/*.png'],
        manifest: {
          id: '/',
          name: APP_NAME,
          short_name: 'AMP',
          description:
            'A Christ-centered recovery and support app for those affected by sexual addiction — Scripture, reflection, grounding tools, and accountability.',
          lang: 'en',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f3f4f7',
          theme_color: '#f3f4f7',
          categories: ['health', 'lifestyle', 'books'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Help Me Now',
              short_name: 'Help',
              url: '/grounding',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Daily Check-In',
              short_name: 'Check In',
              url: '/check-in',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Journal',
              short_name: 'Journal',
              url: '/journal',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/functions\//, /^\/auth\//, /^\/rest\//],
          cleanupOutdatedCaches: true,
          // Personal data (check-ins, journal, etc.) is never cached by the
          // service worker: Supabase requests go straight to the network.
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, host: true },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      setupFiles: ['tests/unit/setup.ts'],
      css: false,
    },
  }
})
