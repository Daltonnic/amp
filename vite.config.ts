/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const APP_NAME = 'Apostolic Moral Purity'

export default defineConfig({
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
})
