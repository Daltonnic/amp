import { expect, test, type Page } from '@playwright/test'

/** Fails the test on any uncaught error or console error. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  return errors
}

async function onboard(page: Page, track: 'men' | 'spouse') {
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { name: 'Welcome to The Journey' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  const cont = page.getByRole('button', { name: 'Continue' })
  await expect(cont).toBeDisabled()
  await page
    .getByRole('button', { name: track === 'men' ? /seeking help for myself/ : /betrayed spouse/ })
    .click()
  await cont.click()

  await expect(cont).toBeDisabled()
  await page.getByRole('textbox', { name: 'What brings you here?' }).fill('I want to walk in freedom.')
  await cont.click()

  const needs =
    track === 'men'
      ? [
          'Growing in self-awareness',
          'Reconnecting with God',
          'Healing at a deeper level',
          'Stabilizing daily rhythms',
        ]
      : ['Feeling safe again', 'Spiritual support', 'Emotional validation', 'Caring for myself']
  for (const need of needs.slice(0, 3)) await page.getByRole('button', { name: need }).click()
  // A fourth choice is disabled ("Select up to 3").
  await expect(page.getByRole('button', { name: needs[3] })).toHaveAttribute('aria-disabled', 'true')
  await cont.click()

  await expect(page.getByRole('heading', { name: 'Daily Reminders' })).toBeVisible()
  await page.getByRole('button', { name: 'Begin The Journey' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible()
}

test('men: onboarding, check-in, insights, journal, triggers, grounding', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men')

  // Home
  await expect(page.getByText('Complete daily check-ins to see your emotional patterns here.')).toBeVisible()
  await expect(page.getByText("Today's Focus")).toBeVisible()
  await expect(page.getByRole('link', { name: /Add an accountability contact/ })).toBeVisible()

  // Daily check-in (6 steps). A custom emotion alone is enough to continue.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Check-In' }).click()
  await expect(page.getByRole('heading', { name: 'Daily Check-In' })).toBeVisible()
  const next = page.getByRole('button', { name: 'Next' })
  await expect(next).toBeDisabled()
  await page.getByRole('textbox', { name: /own words/ }).fill('Tired but hopeful')
  await expect(next).toBeEnabled()
  await page.getByRole('button', { name: 'Hopeful', exact: true }).click()
  await next.click()
  await expect(page.getByText('Temptation level')).toBeVisible()
  await next.click()
  await page.getByLabel('Any recent triggers?').fill('Late night scrolling')
  await next.click()
  await page.getByRole('button', { name: 'seeking' }).click()
  await next.click()
  await page.getByLabel('Am I hiding anything?').fill('No')
  await next.click()
  await page.getByLabel('One intentional next step').fill('Call my pastor')
  await page.getByRole('button', { name: 'Complete' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByText("Today's check-in complete")).toBeVisible()
  await expect(page.getByText('Feeling: Hopeful')).toBeVisible()
  await expect(page.getByText('1/7 days logged')).toBeVisible()
  await expect(page.getByText('Most frequent emotion this week:')).toBeVisible()

  // The check-in is stored under the local date, not UTC.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('amp.device.check_ins') ?? '[]'))
  const localToday = await page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  expect(stored[0].date).toBe(localToday)
  expect(stored[0].intensity).toBeNull()
  expect(stored[0].temptation_level).toBe(3)

  // Journal: write from a guided prompt, view, edit, delete.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Journal' }).click()
  await page.getByRole('button', { name: 'Identity Reflection' }).click()
  await page.getByText('Who does God say I am — apart from my struggle?').click()
  await expect(page.getByText('"Who does God say I am — apart from my struggle?"')).toBeVisible()
  await page.getByLabel('Title (optional)').fill('Who I am')
  await page.getByLabel('Journal entry').fill('A son, not a slave.')
  await page.getByRole('button', { name: 'Save Entry' }).click()
  await expect(page.getByText('Who I am')).toBeVisible()
  await page.getByText('Who I am').click()
  await expect(page.getByText('A son, not a slave.')).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Journal entry').fill('A son, not a slave. Loved.')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.getByText('Who I am').click()
  await expect(page.getByText('A son, not a slave. Loved.')).toBeVisible()
  await page.getByRole('button', { name: 'Delete Entry' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText("Your journal is waiting. Start writing when you're ready.")).toBeVisible()

  // Templates
  await page.getByRole('button', { name: /Evening Recovery/ }).click()
  await expect(page.getByText('How did I do today — honestly, not harshly?')).toBeVisible()
  await page.getByRole('button', { name: 'Go back' }).click()

  // Trigger awareness → log → grounding prompt → AI guide (unavailable offline/device mode)
  await page.goto('/home')
  await page.getByRole('link', { name: 'Log Trigger' }).click()
  await expect(page.getByRole('heading', { name: 'Log a Trigger' })).toBeVisible()
  const save = page.getByRole('button', { name: 'Save Log' })
  await expect(save).toBeDisabled()
  await page.getByRole('button', { name: 'Lonely' }).click()
  await page.getByRole('button', { name: 'Digital' }).click()
  await page.getByLabel('What happened?').fill('Alone at night')
  await page.getByRole('button', { name: 'Reaching out' }).click()
  await save.click()
  await expect(page.getByText('Good. You named it.')).toBeVisible()
  await page.getByRole('button', { name: 'Start Grounding Session' }).click()
  // One-time AI disclosure and consent before anything is sent.
  const consent = page.getByRole('alertdialog', { name: 'Before you start' })
  await expect(consent.getByText(/Anthropic/)).toBeVisible()
  await consent.getByRole('button', { name: 'I agree, continue' }).click()
  const guide = page.getByRole('dialog', { name: 'Grounding Guide' })
  await expect(guide).toBeVisible()
  await expect(guide.getByText(/needs the online service/)).toBeVisible()
  await guide.getByRole('button', { name: 'Close grounding guide' }).click()
  await expect(page.getByRole('heading', { name: 'Trigger Awareness' })).toBeVisible()
  await expect(page.getByText('Alone at night')).toBeVisible()

  // Grounding tools
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Grounding' }).click()
  await expect(page.getByText('Pause. Breathe. Get grounded.')).toBeVisible()
  await expect(page.getByText('Reassurance')).toHaveCount(0) // spouse-only
  await page.getByRole('button', { name: /5-4-3-2-1 Exercise/ }).click()
  await expect(page.getByText('Name 5 things you can see')).toBeVisible()
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Name 1 thing you can taste')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Grounding Tools' })).toBeVisible()
  await page.getByRole('button', { name: /Slow Breathing/ }).click()
  await page.getByRole('button', { name: 'Begin' }).click()
  await expect(page.getByRole('heading', { name: 'Breathe In' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hold' })).toBeVisible({ timeout: 6000 })
  await page.getByRole('button', { name: 'Close breathing exercise' }).click()
  const sessions = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('amp.device.grounding_sessions') ?? '[]'),
  )
  expect(sessions.map((s: { type: string }) => s.type).sort()).toEqual(['breathing', 'guide', 'orienting'])

  expect(errors).toEqual([])
})

test('spouse: track-specific content, resources, identity, library, accountability', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'spouse')

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Check-In' }).click()
  await expect(page.getByText('Your emotions are valid. Name them.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Betrayed', exact: true })).toBeVisible()

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Grounding' }).click()
  await page.getByRole('button', { name: /Reassurance/ }).click()
  await expect(page.getByText('You are safe right now, in this moment.')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // Resources default to the user's track; the tab survives opening an article.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Resources' }).click()
  await expect(page.getByRole('tab', { name: 'Spouses' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: /Understanding Betrayal Trauma/ }).click()
  await page.getByRole('button', { name: /This Is Not Your Fault/ }).click()
  await expect(page.getByText('You did not cause this.')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('tab', { name: 'Men' }).click()
  await expect(
    page.getByRole('button', { name: /The HALT Framework|Understanding Triggers/ }).first(),
  ).toBeVisible()

  // More sheet → Identity & Scripture
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Identity & Scripture' }).click()
  await page.getByRole('button', { name: /Identity in Christ/ }).click()
  await page.getByRole('button', { name: /I am a child of God/ }).click()
  await expect(page.getByText('John 1:12')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('I am forgiven — completely.')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Identity in Christ' })).toBeVisible()

  // Library (empty until admins publish articles)
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Library' }).click()
  await expect(page.getByText('No articles yet')).toBeVisible()

  // Accountability: add + remove a contact; Home shows the one-tap support button.
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Accountability' }).click()
  await page.getByRole('button', { name: 'Add' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Trusted Contact' })
  await dialog.getByLabel('Name').fill('Sister Ruth')
  await dialog.getByLabel('Email').fill('not-an-email')
  await expect(dialog.getByText('Enter a valid email address.')).toBeVisible()
  await dialog.getByLabel('Email').fill('ruth@example.com')
  await dialog.getByLabel('Phone (optional)').fill('555-0100')
  await dialog.getByLabel('Relationship').fill('Mentor')
  await dialog.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByText('Sister Ruth')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Call Sister Ruth' })).toHaveAttribute('href', 'tel:555-0100')
  await page.goto('/home')
  await expect(page.getByRole('button', { name: /I Need Support/ })).toBeVisible()
  await expect(page.getByText('Notify Sister Ruth (Mentor)')).toBeVisible()
  await page.goto('/accountability')
  await page.getByRole('button', { name: 'Remove Sister Ruth' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No contacts yet. Add someone you trust.')).toBeVisible()

  expect(errors).toEqual([])
})

test('settings: PIN lock, theme, legacy links, account deletion', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men')

  // Old Base44 URLs still work.
  await page.goto('/CheckIn')
  await expect(page).toHaveURL(/\/check-in$/)
  await page.goto('/TriggerAwareness?view=new')
  await expect(page).toHaveURL(/\/triggers\?view=new$/)

  await page.goto('/settings')
  await page.getByLabel('Display Name').fill('Mark')
  await page.getByRole('button', { name: 'Save Settings' }).click()
  await page.goto('/home')
  await expect(page.getByText(/, Mark$/)).toBeVisible()

  // Theme
  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  // PIN lock
  await page.getByRole('switch', { name: 'PIN lock' }).click()
  const pinDialog = page.getByRole('dialog', { name: 'Set a PIN' })
  await pinDialog.getByLabel('PIN', { exact: true }).fill('2468')
  await pinDialog.getByLabel('Confirm PIN').fill('1357')
  await pinDialog.getByRole('button', { name: 'Turn on PIN Lock' }).click()
  await expect(pinDialog.getByText("The PINs don't match.")).toBeVisible()
  await pinDialog.getByLabel('Confirm PIN').fill('2468')
  await pinDialog.getByRole('button', { name: 'Turn on PIN Lock' }).click()
  await expect(page.getByRole('switch', { name: 'PIN lock' })).toBeChecked()
  const lockStore = await page.evaluate(() => localStorage.getItem('CapacitorStorage.amp.applock'))
  expect(lockStore).not.toContain('2468')

  await page.reload()
  const lock = page.getByRole('dialog', { name: 'App locked' })
  await expect(lock).toBeVisible()
  for (const d of '1111') await lock.getByRole('button', { name: d, exact: true }).click()
  await lock.getByRole('button', { name: 'Unlock' }).click()
  await expect(lock.getByText('Incorrect PIN. Try again.')).toBeVisible()
  for (const d of '2468') await lock.getByRole('button', { name: d, exact: true }).click()
  await lock.getByRole('button', { name: 'Unlock' }).click()
  await expect(lock).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // Turn the lock off again, then delete everything.
  await page.getByRole('switch', { name: 'PIN lock' }).click()
  await expect(page.getByRole('switch', { name: 'PIN lock' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Delete Account & All Data' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm.getByRole('button', { name: 'Delete Everything' })).toBeDisabled()
  await confirm.getByLabel('Type DELETE to confirm').fill('DELETE')
  await confirm.getByRole('button', { name: 'Delete Everything' }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  const leftovers = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('amp.device.')),
  )
  expect(leftovers).toEqual([])

  expect(errors).toEqual([])
})

test('privacy policy is public and unknown routes show a friendly page', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'This page wandered off' })).toBeVisible()
})
