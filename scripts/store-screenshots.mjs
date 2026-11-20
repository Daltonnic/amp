#!/usr/bin/env node
/**
 * Generates App Store and Google Play screenshots from the running app.
 *
 *   npm run build && npx vite preview --port 4173     # in one terminal
 *   node scripts/store-screenshots.mjs                 # in another
 *
 * Uses on-device mode with sample data, so build without Supabase variables.
 * Output: store/screenshots/{ios,android}/*.png at the stores' required sizes.
 */
import fs from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const TARGETS = {
  // App Store 6.9" iPhone (required): 1320 × 2868
  ios: { width: 440, height: 956, scale: 3 },
  // Google Play phone: 1080 × 2400 (9:20)
  android: { width: 360, height: 800, scale: 3 },
}
const SHOTS = [
  ['01-home', '/home'],
  ['02-check-in', '/check-in'],
  ['03-grounding', '/grounding'],
  ['04-breathing', '/grounding?tool=breathing'],
  ['05-journal', '/journal'],
  ['06-identity', '/identity?section=0&item=2'],
]

function seed() {
  const now = new Date()
  const iso = now.toISOString()
  const uid = '00000000-0000-4000-8000-000000000000'
  const day = (ago) => {
    const d = new Date(now)
    d.setDate(d.getDate() - ago)
    return {
      d,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    }
  }
  localStorage.setItem(
    'amp.device.profiles',
    JSON.stringify([
      {
        id: 'p',
        user_id: uid,
        track: 'men',
        reason: '',
        primary_needs: [],
        display_name: 'David',
        daily_reminders: true,
        reminder_time: '20:00',
        onboarding_complete: true,
        created_at: iso,
        updated_at: iso,
      },
    ]),
  )
  const temptation = [7, 6, 6, 5, 4, 3, 3]
  const stress = [6, 6, 5, 5, 4, 4, 3]
  const emotions = ['Anxious', 'Restless', 'Hopeful', 'Determined', 'Hopeful', 'Grateful', 'Hopeful']
  localStorage.setItem(
    'amp.device.check_ins',
    JSON.stringify(
      [6, 5, 4, 3, 2, 1, 0].map((ago, i) => {
        const { d, date } = day(ago)
        return {
          id: `c${i}`,
          user_id: uid,
          track: 'men',
          date,
          emotions: [emotions[i]],
          custom_emotion: '',
          intensity: null,
          temptation_level: temptation[i],
          stress_level: stress[i],
          recent_triggers: '',
          spiritual_condition: '',
          honesty_check: '',
          next_step: '',
          body_awareness: '',
          primary_fear: '',
          current_need: '',
          reflection: '',
          created_at: d.toISOString(),
        }
      }),
    ),
  )
  localStorage.setItem(
    'amp.device.accountability_contacts',
    JSON.stringify([
      {
        id: 'a',
        user_id: uid,
        name: 'Pastor James',
        email: 'pastor@example.org',
        phone: '',
        relationship: 'Pastor',
        created_at: iso,
      },
    ]),
  )
  localStorage.setItem(
    'amp.device.journal_entries',
    JSON.stringify([
      {
        id: 'j1',
        user_id: uid,
        track: 'men',
        title: 'Who God says I am',
        content: 'Not my worst moment. A son, being made new.',
        category: 'identity_reflection',
        prompt_used: '',
        created_at: iso,
        updated_at: iso,
      },
      {
        id: 'j2',
        user_id: uid,
        track: 'men',
        title: 'Evening recovery',
        content: 'I reached out instead of hiding today.',
        category: 'pattern_awareness',
        prompt_used: '',
        created_at: day(1).d.toISOString(),
        updated_at: iso,
      },
      {
        id: 'j3',
        user_id: uid,
        track: 'men',
        title: 'Grateful',
        content: 'For honest friends and a new morning.',
        category: 'spiritual_reflection',
        prompt_used: '',
        created_at: day(3).d.toISOString(),
        updated_at: iso,
      },
    ]),
  )
  localStorage.setItem('amp.installPromptDismissed', '1')
}

const browser = await chromium.launch()
for (const [platform, t] of Object.entries(TARGETS)) {
  const dir = `store/screenshots/${platform}`
  fs.mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: t.width, height: t.height },
    deviceScaleFactor: t.scale,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/privacy`)
  await page.evaluate(seed)
  for (const [name, path] of SHOTS) {
    await page.goto(BASE + path)
    await page.waitForTimeout(800)
    if (name === '02-check-in') {
      await page.getByRole('button', { name: 'Hopeful', exact: true }).click()
      await page.waitForTimeout(500)
    }
    if (name === '04-breathing') {
      await page.getByRole('button', { name: 'Begin' }).click()
      await page.waitForTimeout(3000)
    }
    await page.screenshot({ path: `${dir}/${name}.png` })
  }
  await context.close()
  console.log(
    `${platform}: ${SHOTS.length} screenshots → ${dir} (${t.width * t.scale}×${t.height * t.scale})`,
  )
}
await browser.close()
