import { expect, test, type Page } from '@playwright/test'

/** Records links the app opens in Messages / Mail instead of navigating away. */
async function captureExternalLinks(page: Page) {
  await page.addInitScript(() => {
    const w = window as Window & { __ampOpened?: string[]; __ampOpenExternal?: (url: string) => void }
    w.__ampOpened = []
    w.__ampOpenExternal = (url) => w.__ampOpened!.push(url)
  })
  return () => page.evaluate(() => (window as Window & { __ampOpened?: string[] }).__ampOpened ?? [])
}

/** Fails the test on any uncaught error or console error. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  return errors
}

/** The faded photo behind the current screen. */
const background = (page: Page) => page.locator('img[src^="/backgrounds/"]')

async function onboard(page: Page, track: 'men' | 'spouse', gender: 'man' | 'woman' = 'man') {
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { name: 'Welcome to The Journey' })).toBeVisible()
  await expect(background(page)).toHaveAttribute('src', /sunset-study/)
  await page.getByRole('button', { name: 'Continue' }).click()

  const cont = page.getByRole('button', { name: 'Continue' })
  // A name is required.
  await expect(page.getByRole('heading', { name: "What's your name?" })).toBeVisible()
  await expect(cont).toBeDisabled()
  await page.getByLabel('First name', { exact: true }).fill('Sam')
  await expect(page.getByText('Others will see:')).toContainText('Sam')
  await cont.click()

  await expect(page.getByRole('heading', { name: 'A little about you' })).toBeVisible()
  await expect(cont).toBeDisabled()
  await page.getByRole('button', { name: gender === 'man' ? "I'm a man" : "I'm a woman" }).click()
  await cont.click()

  await expect(cont).toBeDisabled()
  await expect(
    page.getByText(`Formation and support for ${gender === 'man' ? 'men' : 'women'} pursuing freedom`),
  ).toBeVisible()
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
  // Help Me Now opens "I Need Support"; with nobody added yet it offers to add someone.
  await page.getByRole('button', { name: 'Help Me Now' }).click()
  const help = page.getByRole('dialog', { name: 'I Need Support' })
  await expect(help.getByRole('link', { name: 'Add a support person' })).toBeVisible()
  await expect(help.getByRole('link', { name: '988' })).toHaveAttribute('href', 'tel:988')
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()

  // Daily check-in (6 steps), opened from the orange Check In button on Home.
  // A custom emotion alone is enough to continue.
  await page.getByRole('link', { name: /How are you today\?.*Check In/ }).click()
  await expect(page.getByRole('heading', { name: 'Daily Check-In' })).toBeVisible()
  const next = page.getByRole('button', { name: 'Next' })
  await expect(next).toBeDisabled()
  await page.getByRole('textbox', { name: /own words/ }).fill('Tired but hopeful')
  await expect(next).toBeEnabled()
  // Several feelings can be selected, and tapping one again deselects it.
  for (const feeling of ['Hopeful', 'Anxious', 'Grateful', 'Restless']) {
    await page.getByRole('button', { name: feeling, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Restless', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Restless', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByRole('button', { name: 'Grateful', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await next.click()
  await expect(page.getByText('Temptation level')).toBeVisible()
  // Stress can go all the way down to 0 ("none").
  const stress = page.getByRole('slider', { name: 'Stress level' })
  await expect(stress).toHaveAttribute('aria-valuemin', '0')
  await stress.focus()
  await page.keyboard.press('Home')
  await expect(stress).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByText('0/10')).toBeVisible()
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
  await expect(page.getByText('Feeling: Hopeful, Anxious, Grateful, Tired but hopeful')).toBeVisible()
  await expect(page.getByText('1/7 days logged')).toBeVisible()
  await expect(page.getByText('Most frequent emotion this week:')).toBeVisible()

  // The check-in is stored under the local date, not UTC.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('amp.device.check_ins') ?? '[]'))
  const localToday = await page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  expect(stored[0].date).toBe(localToday)
  expect(stored[0].emotions).toEqual(['Hopeful', 'Anxious', 'Grateful'])
  expect(stored[0].custom_emotion).toBe('Tired but hopeful')
  expect(stored[0].intensity).toBeNull()
  expect(stored[0].temptation_level).toBe(3)
  expect(stored[0].stress_level).toBe(0)

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

  // Trigger awareness → log → straight to the grounding tools
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
  await page.getByRole('button', { name: 'Open Grounding Tools' }).click()
  await expect(page.getByRole('heading', { name: 'Grounding Tools' })).toBeVisible()
  await page.goto('/triggers')
  await expect(page.getByRole('heading', { name: 'Trigger Awareness' })).toBeVisible()
  await expect(page.getByText('Alone at night')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ground through this' })).toHaveAttribute('href', '/grounding')

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
  expect(sessions.map((s: { type: string }) => s.type).sort()).toEqual(['breathing', 'orienting'])

  expect(errors).toEqual([])
})

test('spouse: track-specific content, resources, identity, library, accountability', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'spouse', 'man')

  // A betrayed spouse sees family, nature or faith-building photos.
  await page.goto('/resources')
  await expect(background(page)).toHaveAttribute('src', /pastoral-counsel\.webp/)
  await page.goto('/journal')
  await expect(background(page)).toHaveAttribute('src', /sunset-study/)

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Check-In' }).click()
  await expect(page.getByText('Your emotions are valid. Name them.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Betrayed', exact: true })).toBeVisible()

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Grounding' }).click()
  await page.getByRole('button', { name: /Reassurance/ }).click()
  await expect(page.getByText('You are safe right now, in this moment.')).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()

  // Resources default to the user's track; the tab survives opening an article.
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Resources' }).click()
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

  // Library: hidden from the menu until an article is published, then shown.
  await page.getByRole('button', { name: 'More sections' }).click()
  await expect(page.getByRole('link', { name: 'Identity & Scripture' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Library' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const now = new Date().toISOString()
    localStorage.setItem(
      'amp.device.library_articles',
      JSON.stringify([
        {
          id: 'a1',
          title: 'Walking in the Light',
          content: 'First paragraph.\n\nSecond paragraph.',
          category: 'scripture_teaching',
          track: 'both',
          scripture_reference: '1 John 1:7',
          read_time_minutes: 5,
          tags: 'honesty, light',
          featured: true,
          published: true,
          created_at: now,
          updated_at: now,
        },
      ]),
    )
  })
  await page.reload()
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Library' }).click()
  await page
    .getByRole('button', { name: /Walking in the Light/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Walking in the Light' })).toBeVisible()
  await expect(page.getByText('Second paragraph.')).toBeVisible()

  // Accountability: add + remove a contact; support opens a ready-to-send text.
  const openedLinks = await captureExternalLinks(page)
  await page.reload()
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Accountability' }).click()
  await page.getByRole('button', { name: 'Add' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Trusted Contact' })
  await dialog.getByLabel('Name').fill('Sister Ruth')
  // A way to reach them (mobile or email) is required.
  await expect(dialog.getByRole('button', { name: 'Add Contact' })).toBeDisabled()
  await dialog.getByLabel('Email (optional)').fill('not-an-email')
  await expect(dialog.getByText('Enter a valid email address.')).toBeVisible()
  await dialog.getByLabel('Email (optional)').fill('ruth@example.com')
  await dialog.getByLabel('Mobile number').fill('(555) 010-0100')
  await dialog.getByLabel('Relationship').fill('Mentor')
  await dialog.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByText('Sister Ruth')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Call Sister Ruth' })).toHaveAttribute('href', 'tel:5550100100')
  await page.getByRole('button', { name: 'Request Check-In' }).click()
  const checkInLink = (await openedLinks()).at(-1) ?? ''
  expect(checkInLink).toMatch(/^sms:5550100100[?&]body=/)
  expect(decodeURIComponent(checkInLink)).toContain('Hi Sister, could you check in on me')

  // Help Me Now lists support people; tapping one opens a ready-to-send text.
  await page.goto('/home')
  await page.getByRole('button', { name: 'Help Me Now' }).click()
  const helpSheet = page.getByRole('dialog', { name: 'I Need Support' })
  await expect(helpSheet.getByRole('button', { name: /Sister Ruth.*Mentor.*Text/ })).toBeVisible()
  await helpSheet.getByRole('button', { name: /Sister Ruth/ }).click()
  expect(decodeURIComponent((await openedLinks()).at(-1) ?? '')).toContain('I need support right now.')
  await expect(helpSheet).toBeHidden()

  // Every support person is listed; one without a mobile number gets an email.
  await page.goto('/accountability')
  await page.getByRole('button', { name: 'Add' }).click()
  await dialog.getByLabel('Name').fill('Pastor Dan')
  await dialog.getByLabel('Email (optional)').fill('dan@example.com')
  await dialog.getByRole('button', { name: 'Add Contact' }).click()
  await expect(page.getByText('Pastor Dan')).toBeVisible()
  // The "Help Me Now" app shortcut opens the same list.
  await page.goto('/home?help=1')
  const chooser = page.getByRole('dialog', { name: 'I Need Support' })
  await expect(chooser.getByRole('button', { name: /Sister Ruth/ })).toBeVisible()
  await chooser.getByRole('button', { name: /Pastor Dan/ }).click()
  expect((await openedLinks()).at(-1)).toMatch(/^mailto:dan%40example\.com\?subject=I%20need%20support/)
  await page.goto('/accountability')
  await page.getByRole('button', { name: 'Remove Pastor Dan' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Pastor Dan')).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove Sister Ruth' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No contacts yet. Add someone you trust.')).toBeVisible()

  expect(errors).toEqual([])
})

test('settings: PIN lock, theme, legacy links, account deletion', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men')

  // A man in recovery sees men or nature.
  await page.goto('/accountability')
  await expect(background(page)).toHaveAttribute('src', /pastoral-counsel-men/)
  await page.goto('/journal')
  await expect(background(page)).toHaveAttribute('src', /sunset-study/)

  // Old Base44 URLs still work.
  await page.goto('/CheckIn')
  await expect(page).toHaveURL(/\/check-in$/)
  await page.goto('/TriggerAwareness?view=new')
  await expect(page).toHaveURL(/\/triggers\?view=new$/)

  await page.goto('/settings')
  await page.getByLabel('First name', { exact: true }).fill('Mark')
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

test('woman in recovery: her own wording and photos, and the one-tap question', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men', 'woman')

  await page.goto('/journal')
  await expect(background(page)).toHaveAttribute('src', /quiet-reflection/)
  await page.goto('/resources')
  await expect(page.getByRole('tab', { name: 'Women' })).toBeVisible()
  await expect(background(page)).toHaveAttribute('src', /quiet-reflection/)
  await page.goto('/settings')
  await expect(page.getByText("Women's Formation")).toBeVisible()

  // Someone without a name can't use the app until they add one.
  await page.evaluate(() => {
    const key = 'amp.device.profiles'
    const rows = JSON.parse(localStorage.getItem(key) ?? '[]') as Record<string, unknown>[]
    for (const row of rows) row.display_name = ''
    localStorage.setItem(key, JSON.stringify(rows))
  })
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: "What's your name?" })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  const nameContinue = page.getByRole('button', { name: 'Continue' })
  await expect(nameContinue).toBeDisabled()
  await page.getByLabel('First name', { exact: true }).fill('Ruth')
  await nameContinue.click()
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible()
  await expect(page.getByText(/, Ruth$/)).toBeVisible()

  // Someone who set up before the question existed is asked once on Home,
  // and sees only nature until they answer.
  await page.evaluate(() => {
    const key = 'amp.device.profiles'
    const rows = JSON.parse(localStorage.getItem(key) ?? '[]') as Record<string, unknown>[]
    for (const row of rows) delete row.gender
    localStorage.setItem(key, JSON.stringify(rows))
  })
  await page.goto('/journal')
  await expect(background(page)).toHaveAttribute('src', /sunset-study/)
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'One quick question' })).toBeVisible()
  await page.getByRole('button', { name: "I'm a woman" }).click()
  await expect(page.getByRole('heading', { name: 'One quick question' })).toBeHidden()
  await page.goto('/journal')
  await expect(background(page)).toHaveAttribute('src', /quiet-reflection/)

  expect(errors).toEqual([])
})

test('group chat: join with a chosen name, send, reply, like, delete, leave', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men', 'man')

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Group' }).click()
  await expect(page.getByRole('heading', { name: 'Men in Recovery' })).toBeVisible()
  await expect(background(page)).toHaveAttribute('src', /sunset-study/)

  // Choose how your name shows; Join waits for a name and the guidelines.
  const join = page.getByRole('button', { name: 'Join the group' })
  await expect(join).toBeDisabled()
  await page.getByLabel('First name', { exact: true }).fill('David')
  await page.getByLabel(/Last name/).fill('Miller')
  const preview = page.getByText('Others will see:')
  await expect(preview).toContainText('David M.')
  await page.getByRole('radio', { name: /Initials only/ }).check()
  await expect(preview).toContainText('D.M.')
  await page.getByRole('radio', { name: /A nickname/ }).check()
  await expect(preview).toContainText('add your name above')
  await page.getByLabel('Nickname', { exact: true }).fill('Steady')
  await expect(preview).toContainText('Steady')
  await page.getByRole('radio', { name: /First name and last initial/ }).check()
  await expect(join).toBeDisabled()
  await page.getByRole('checkbox', { name: 'I agree to follow these guidelines' }).check()
  await join.click()

  const log = page.getByRole('log', { name: 'Men in Recovery messages' })
  await expect(log).toBeVisible()
  await expect(log.getByText('You joined the group')).toBeVisible()
  await expect(log.getByText('Be the first to say hello')).toBeVisible()

  // The message bar sits right on the tab bar (no gap), even with few messages.
  const gap = await page.evaluate(() => {
    const bar = document.querySelector('textarea[aria-label="Message the group"]')!.closest('form')!
    const tabs = document.querySelector('nav[aria-label="Main"]')!
    return Math.abs(tabs.getBoundingClientRect().top - bar.getBoundingClientRect().bottom)
  })
  expect(gap).toBeLessThanOrEqual(1)

  // Send
  const box = page.getByRole('textbox', { name: 'Message the group' })
  const send = page.getByRole('button', { name: 'Send' })
  await expect(send).toBeDisabled()
  await box.fill('Day 30 today. Grateful for this group.')
  await send.click()
  await expect(log.getByText('Day 30 today. Grateful for this group.')).toBeVisible()
  await expect(box).toHaveValue('')

  // Reply
  await log
    .getByRole('button', { name: /^Your message at .*Show options$/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Reply', exact: true }).click()
  await expect(page.getByText('Replying to You')).toBeVisible()
  await box.fill('And grateful for each of you.')
  await send.click()
  await expect(log.getByText('And grateful for each of you.')).toBeVisible()
  await expect(page.getByText('Replying to You')).toBeHidden()

  // Like
  await log
    .getByRole('button', { name: /^Your message at .*Show options$/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Like', exact: true }).click()
  await expect(log.getByRole('button', { name: 'Unlike (1 like)' })).toBeVisible()

  // Delete
  await log
    .getByRole('button', { name: /^Your message at .*Show options$/ })
    .last()
    .click()
  await page.getByRole('button', { name: 'Delete message' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(log.getByText('This message was deleted')).toBeVisible()
  await expect(log.getByText('And grateful for each of you.')).toBeHidden()

  // Members
  await page.getByRole('button', { name: /Men in Recovery, 1 member/ }).click()
  const members = page.getByRole('list', { name: 'Members' })
  await expect(members.getByText('David M.')).toBeVisible()
  await expect(members.getByText('You', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // Settings: your group, and leaving it.
  await page.goto('/settings')
  await expect(page.getByText('Your group')).toBeVisible()
  await page.getByRole('button', { name: 'Leave group' }).click()
  await page.getByRole('button', { name: 'Leave group' }).last().click()
  await expect(page.getByText('Your group')).toBeHidden()
  await page.goto('/group')
  await expect(page.getByRole('button', { name: 'Join the group' })).toBeVisible()

  expect(errors).toEqual([])
})

test('notifications: one-tap button on Home, toggles in Settings', async ({ page }) => {
  // Stand-in for the browser's push service, kept across page loads.
  await page.addInitScript(() => {
    const key = 'amp.fakePush'
    const state = JSON.parse(
      sessionStorage.getItem(key) ?? '{"permission":"default","subscribed":false,"preview":false}',
    )
    ;(window as Window & { __ampFakePush?: unknown }).__ampFakePush = new Proxy(state, {
      set(target, prop, value) {
        target[prop] = value
        sessionStorage.setItem(key, JSON.stringify(target))
        return true
      },
    })
  })
  const errors = watchErrors(page)
  await onboard(page, 'men', 'man')

  const card = page.getByRole('heading', { name: 'Get notified about your group' })
  await expect(card).toBeVisible()
  await expect(page.getByText(/Group messages and meeting reminders/)).toBeVisible()
  await page.getByRole('button', { name: 'Turn on notifications' }).click()
  await expect(page.getByText(/Notifications are on/)).toBeVisible()
  await expect(card).toBeHidden()

  await page.goto('/settings')
  const pushSwitch = page.getByRole('switch', { name: 'Push notifications' })
  const previewSwitch = page.getByRole('switch', { name: 'Show details in notifications' })
  await expect(pushSwitch).toBeChecked()
  await expect(previewSwitch).not.toBeChecked()
  await expect(page.getByText(/Off for privacy/)).toBeVisible()
  await previewSwitch.click()
  await expect(previewSwitch).toBeChecked()

  // Everything, messages only, or meetings only.
  await expect(page.getByRole('tab', { name: 'Everything' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Meetings' }).click()
  await expect(page.getByText('Only meeting reminders, no group messages.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Meetings' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Messages' }).click()
  await expect(page.getByText('Only group messages, no meeting reminders.')).toBeVisible()
  await pushSwitch.click()
  await expect(pushSwitch).not.toBeChecked()
  await expect(previewSwitch).toBeHidden()

  // Off again: Home offers it again, and "Not now" hides it on this device.
  await page.goto('/home')
  await expect(card).toBeVisible()
  await page.getByRole('region', { name: 'Notifications' }).getByRole('button', { name: 'Not now' }).click()
  await expect(card).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible()
  await expect(card).toBeHidden()

  expect(errors).toEqual([])
})

test('freedom counter: start on Home; restart and edit in Settings', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men', 'man')

  const card = page.locator('#freedom')
  await expect(page.getByText('Freedom counter')).toBeVisible()
  await page.getByRole('button', { name: 'Start today' }).click()
  await expect(card.getByText('Day 1', { exact: true })).toBeVisible()
  await expect(page.getByText(/1 day to 1 day/)).toBeVisible()
  // Restarting and editing aren't on Home.
  await expect(page.getByRole('button', { name: /Start again|Edit start date/ })).toHaveCount(0)

  // Settings: set the start 30 days back.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Edit start date' }).click()
  const thirtyDaysAgo = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  await page.getByLabel('My current stretch of freedom began on').fill(thirtyDaysAgo)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/30 days of freedom · since/)).toBeVisible()

  // Home celebrates the milestone; the small badge shows the count too.
  await page.goto('/home')
  await expect(page.getByText('30 days of freedom!')).toBeVisible()
  await expect(page.getByText(/30 days to 60 days/)).toBeVisible()
  const badge = page.getByRole('link', { name: '30 days of freedom. Show freedom counter' })
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('Days of Freedom')

  // Settings: starting again is met with grace, and the longest stretch is kept.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Start again' }).click()
  const grace = page.getByRole('dialog', { name: 'Grace for today' })
  await expect(grace.getByText(/new every morning/)).toBeVisible()
  await expect(grace.getByText(/Your 30 days still count/)).toBeVisible()
  await grace.getByRole('button', { name: 'Start again today' }).click()
  await expect(page.getByText(/Longest: 30 days/)).toBeVisible()
  await page.goto('/home')
  await expect(card.getByText('Day 1', { exact: true })).toBeVisible()
  await expect(page.getByText(/Longest: 30 days/)).toBeVisible()

  // "Reach out to someone first" opens Help Me Now.
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Start again' }).click()
  await page.getByRole('button', { name: 'Reach out to someone first' }).click()
  await expect(page.getByRole('dialog', { name: 'I Need Support' })).toBeVisible()
  await page.keyboard.press('Escape')

  // It can be hidden in Settings.
  await page.goto('/settings')
  await page.getByRole('switch', { name: 'Show freedom counter' }).click()
  await page.getByRole('button', { name: 'Save Settings' }).click()
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'The Journey' })).toBeVisible()
  await expect(page.getByText(/of freedom|Day 1/i)).toHaveCount(0)

  expect(errors).toEqual([])
})

test('moderators: page for moderators, and everyone else asks to join', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men', 'man')

  // On this device you're a moderator: the Moderators page is in More, with the yellow shield.
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Moderators' }).click()
  await expect(page).toHaveURL(/\/moderators$/)
  await expect(page.getByRole('heading', { name: 'Moderators', level: 1 })).toBeVisible()
  await page.getByRole('tab', { name: 'Requests' }).click()
  await expect(page.getByText('No one is waiting')).toBeVisible()
  await page.getByRole('tab', { name: 'People' }).click()
  await expect(
    page.getByRole('list', { name: 'People' }).getByText('Moderator', { exact: true }),
  ).toBeVisible()
  // The badge's shield is filled yellow.
  const fill = await page
    .getByRole('list', { name: 'People' })
    .getByText('Moderator', { exact: true })
    .locator('svg')
    .evaluate((el) => getComputedStyle(el).fill)
  expect(fill).toMatch(/^rgb\(2\d\d, 1[6-9]\d, \d{1,2}\)$/)
  await page.getByRole('tab', { name: 'Moderators' }).click()
  await expect(page.getByText('There must always be at least one moderator.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Step down' })).toHaveCount(0)
  await expect(page.getByText(/leader/i)).toHaveCount(0)

  // Someone who isn't a moderator: no Moderators page (old /leaders links
  // land on it too), and joining waits for approval.
  await page.evaluate(() => localStorage.setItem('amp.device.leaders', '[]'))
  await page.goto('/leaders')
  await expect(page).toHaveURL(/\/moderators$/)
  await expect(page.getByText('Moderators only')).toBeVisible()
  await page.goto('/group')
  await page.getByLabel('First name', { exact: true }).fill('Ben')
  await expect(page.getByText('a moderator approves each new member')).toBeVisible()
  await page.getByRole('checkbox', { name: 'I agree to follow these guidelines' }).check()
  await page.getByRole('button', { name: 'Ask to join' }).click()
  await expect(page.getByRole('heading', { name: 'Your request has been sent' })).toBeVisible()
  await expect(page.getByText(/A moderator will welcome you/)).toBeVisible()
  await page.getByRole('button', { name: 'More sections' }).click()
  await expect(page.getByRole('link', { name: 'Moderators' })).toHaveCount(0)

  expect(errors).toEqual([])
})

test('calendar: leaders add meetings with reminders; each group sees its own', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men', 'man')

  // On this device you lead: More → Calendar, then Add event.
  await page.getByRole('button', { name: 'More sections' }).click()
  await page.getByRole('link', { name: 'Calendar' }).click()
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
  await expect(page.getByText('No meetings yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Add event' }).click()

  const form = page.getByRole('dialog', { name: 'Add an event' })
  await form.getByLabel('Title').fill('Tuesday Night Group')
  // Your own group is chosen already.
  await expect(form.getByRole('button', { name: 'Men in Recovery', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const tomorrow = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  await form.getByLabel('Date').fill(tomorrow)
  await form.getByLabel('Starts at').fill('19:00')
  await form.getByLabel('How long').selectOption('90')
  await form.getByLabel('How often').selectOption('weekly')
  await form.getByLabel('Where (optional)').fill('https://meet.example.org/tuesday')
  // Suggested reminders are preset; add 15 minutes before.
  await expect(form.getByRole('button', { name: '1 day before', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(form.getByRole('button', { name: '1 hour before', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await form.getByRole('button', { name: '15 minutes before', exact: true }).click()
  await form.getByRole('button', { name: 'Add event', exact: true }).click()
  await expect(form).toBeHidden()

  // It shows up, with its details.
  const upcoming = page
    .getByRole('region', { name: 'Coming up' })
    .or(page.locator('section', { has: page.getByRole('heading', { name: 'Coming up' }) }))
  await expect(upcoming.getByRole('button', { name: /^(New: )?Tuesday Night Group/ }).first()).toBeVisible()
  await upcoming
    .getByRole('button', { name: /^(New: )?Tuesday Night Group/ })
    .first()
    .click()
  const details = page.getByRole('dialog', { name: 'Tuesday Night Group' })
  await expect(details.getByText(/7:00 – 8:30 PM/)).toBeVisible()
  await expect(details.getByText(/^Every week on /)).toBeVisible()
  await expect(details.getByText('Reminders: 1 day before, 1 hour before, 15 minutes before')).toBeVisible()
  await expect(details.getByRole('link', { name: 'https://meet.example.org/tuesday' })).toBeVisible()

  // RSVP: Going, with the count; leaders also see who.
  const rsvp = details.getByRole('group', { name: 'RSVP' })
  await expect(rsvp.getByText('No one has said they’re going yet.')).toBeVisible()
  await rsvp.getByRole('button', { name: 'Going' }).click()
  await expect(rsvp.getByRole('button', { name: 'Going' })).toHaveAttribute('aria-pressed', 'true')
  await expect(rsvp.getByText('1 going')).toBeVisible()
  await expect(rsvp.getByText(/Going \(1\):/)).toBeVisible()
  // Changing to "Can't make it" turns off reminders for that date.
  await rsvp.getByRole('button', { name: 'Can’t make it' }).click()
  await expect(rsvp.getByText(/won’t get reminders for this date/)).toBeVisible()
  await rsvp.getByRole('button', { name: 'Going' }).click()
  await page.keyboard.press('Escape')
  await expect(upcoming.getByRole('button', { name: /Tuesday Night Group.*Going/ }).first()).toBeVisible()

  // Home shows the next meeting, and that you're going.
  await page.goto('/home')
  await expect(page.getByRole('link', { name: /Next meeting.*Tuesday Night Group/ })).toBeVisible()
  await expect(page.getByText('· You’re going')).toBeVisible()

  // The group chat has a calendar button.
  await page.goto('/group')
  await expect(page.getByRole('link', { name: 'Group calendar' })).toBeVisible()

  // Someone who isn't a leader sees the meeting but can't add events.
  await page.evaluate(() => localStorage.setItem('amp.device.leaders', '[]'))
  await page.goto('/calendar')
  await expect(page.getByText('Meetings for Men in Recovery')).toBeVisible()
  await expect(page.getByRole('button', { name: /^(New: )?Tuesday Night Group/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add event' })).toHaveCount(0)

  // A leader can delete it.
  await page.evaluate(() => localStorage.removeItem('amp.device.leaders'))
  await page.goto('/calendar')
  await page
    .getByRole('button', { name: /^(New: )?Tuesday Night Group/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).last().click()
  await expect(page.getByText('No meetings yet.')).toBeVisible()

  expect(errors).toEqual([])
})

test('notifications: bell on Home, the list, opening, removing and reading', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page, 'men', 'man')

  // Seed what the server would have written: a reply, a meeting reminder for
  // tomorrow at 7 PM, and an older "you're in" that was already read.
  const at = await page.evaluate(() => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 19, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T19:00:00`
    const now = Date.now()
    const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
    localStorage.setItem(
      'amp.device.calendar_events',
      JSON.stringify([
        {
          id: 'ev1',
          rooms: ['men-recovery'],
          title: 'Tuesday Night Group',
          description: '',
          location: '',
          starts_local: local,
          timezone: 'America/Chicago',
          duration_minutes: 60,
          repeat: 'none',
          repeat_until: null,
          reminders: [60],
          created_by: null,
          created_at: iso(0),
          updated_at: iso(0),
        },
      ]),
    )
    const base = {
      user_id: 'me',
      message_id: null,
      event_id: null,
      occurrence_start: null,
      subject_user: null,
    }
    localStorage.setItem(
      'amp.device.notifications',
      JSON.stringify([
        {
          ...base,
          id: 'n1',
          kind: 'reply',
          title: 'Mark T. replied to you',
          body: 'Praying for you today.',
          url: '/group',
          created_at: iso(5 * 60_000),
          read_at: null,
        },
        {
          ...base,
          id: 'n2',
          kind: 'meeting',
          title: 'Tuesday Night Group',
          body: '',
          url: `/calendar?event=ev1&at=${start.getTime()}`,
          event_id: 'ev1',
          occurrence_start: start.toISOString(),
          created_at: iso(60_000),
          read_at: null,
        },
        {
          ...base,
          id: 'n3',
          kind: 'join_approved',
          title: "You're in! Welcome to Men in Recovery",
          body: 'Your request was approved. Say hello to the group.',
          url: '/group',
          created_at: iso(2 * 86_400_000),
          read_at: iso(86_400_000),
        },
      ]),
    )
    return start.getTime()
  })
  await page.reload()

  // The bell shows how many are new; so does More.
  const bell = page.getByRole('link', { name: 'Notifications, 2 new' })
  await expect(bell).toBeVisible()
  await page.getByRole('button', { name: 'More sections' }).click()
  await expect(page.getByRole('link', { name: /Notifications\s*2 new/ })).toBeVisible()
  await page.keyboard.press('Escape')

  await bell.click()
  await expect(page).toHaveURL(/\/notifications$/)
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  const fresh = page.locator('section', { has: page.getByText('New', { exact: true }) })
  const earlier = page.locator('section', { has: page.getByText('Earlier', { exact: true }) })
  await expect(fresh.getByRole('button', { name: /^(New: )?Mark T\. replied to you/ })).toBeVisible()
  await expect(fresh.getByText('Praying for you today.')).toBeVisible()
  await expect(fresh.getByRole('button', { name: /^(New: )?Tuesday Night Group/ })).toContainText(
    'Starts tomorrow at 7:00 PM',
  )
  await expect(earlier.getByRole('button', { name: /^You're in! Welcome to Men in Recovery/ })).toBeVisible()

  // Remove one.
  await page.getByRole('button', { name: "Remove “You're in! Welcome to Men in Recovery”" }).click()
  await expect(page.getByText('Welcome to Men in Recovery')).toHaveCount(0)

  // Tapping a meeting reminder opens that meeting.
  await fresh.getByRole('button', { name: /^(New: )?Tuesday Night Group/ }).click()
  await expect(page).toHaveURL(new RegExp(`/calendar\\?event=ev1&at=${at}$`))
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Tuesday Night Group')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/calendar$/)

  // Leaving the list counted everything on it as read.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()

  // A new reply: visiting the group counts as reading it.
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('amp.device.notifications') ?? '[]')
    rows.push({
      id: 'n4',
      user_id: 'me',
      kind: 'reply',
      title: 'Mark T. replied to you',
      body: 'Me too.',
      url: '/group',
      message_id: null,
      event_id: null,
      occurrence_start: null,
      subject_user: null,
      created_at: new Date().toISOString(),
      read_at: null,
    })
    localStorage.setItem('amp.device.notifications', JSON.stringify(rows))
  })
  await page.reload()
  await expect(page.getByRole('link', { name: 'Notifications, 1 new' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Group' }).click()
  await expect(page.getByRole('heading', { name: 'Men in Recovery' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()

  // Mark all read, and the link to notification settings.
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('amp.device.notifications') ?? '[]')
    localStorage.setItem(
      'amp.device.notifications',
      JSON.stringify(rows.map((n: { read_at: string | null }) => ({ ...n, read_at: null }))),
    )
  })
  await page.goto('/notifications')
  await expect(page.getByText('New', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mark all read' }).click()
  await expect(page.getByText('New', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings#notifications$/)

  // Nothing left: a friendly empty state.
  await page.evaluate(() => localStorage.setItem('amp.device.notifications', '[]'))
  await page.goto('/notifications')
  await expect(page.getByText('You’re all caught up')).toBeVisible()
  expect(errors).toEqual([])
})

test('privacy policy is public and unknown routes show a friendly page', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'This page wandered off' })).toBeVisible()
})
