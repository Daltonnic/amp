import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the production build in on-device mode (no
 * Supabase variables), at iPhone size. Start with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    // A phone in a U.S. timezone, where evening check-ins cross the UTC date line.
    ...devices['iPhone 15'],
    browserName: 'chromium',
    timezoneId: 'America/Chicago',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run build -- --mode e2e && npx vite preview --port 4173 --strictPort --mode e2e',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
})
