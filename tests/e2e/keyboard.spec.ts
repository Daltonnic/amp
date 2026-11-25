import { expect, test, type Page } from '@playwright/test'

// The tab bar steps aside while the on-screen keyboard is open. Phones don't
// always report the keyboard closing; these make sure the tab bar always
// comes back (it used to stay hidden until the app was restarted).
//
// A stand-in for the phone's visual viewport, so the test can "open" and
// "close" the on-screen keyboard (and skip events, like iOS sometimes does).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const target = new EventTarget() as EventTarget & Record<string, unknown>
    let keyboard = false
    Object.defineProperties(target, {
      height: { get: () => (keyboard ? Math.round(window.innerHeight * 0.55) : window.innerHeight) },
      width: { get: () => window.innerWidth },
      scale: { get: () => 1 },
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      pageTop: { get: () => window.scrollY },
      pageLeft: { get: () => 0 },
    })
    Object.defineProperty(window, 'visualViewport', { get: () => target })
    ;(window as unknown as { __kb: (open: boolean, fire?: boolean) => void }).__kb = (open, fire = true) => {
      keyboard = open
      if (fire) target.dispatchEvent(new Event('resize'))
    }
  })
})

const kb = (page: Page, open: boolean, fire = true) =>
  page.evaluate(([o, f]) => (window as unknown as { __kb: (a: boolean, b: boolean) => void }).__kb(o, f), [
    open,
    fire,
  ] as const)

async function setup(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('First name', { exact: true }).fill('Sam')
  const cont = page.getByRole('button', { name: 'Continue' })
  await cont.click()
  await page.getByRole('button', { name: "I'm a man" }).click()
  await cont.click()
  await page.getByRole('button', { name: /seeking help for myself/ }).click()
  await cont.click()
  await page.getByRole('textbox', { name: 'What brings you here?' }).fill('x')
  await cont.click()
  await page.getByRole('button', { name: 'Reconnecting with God' }).click()
  await cont.click()
  await page.getByRole('button', { name: 'Begin The Journey' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Group' }).click()
  await page.getByRole('checkbox', { name: 'I agree to follow these guidelines' }).check()
  await page.getByRole('button', { name: 'Join the group' }).click()
}

test('keyboard closes without the phone saying so (left the app and came back)', async ({ page }) => {
  await setup(page)
  const tabs = page.getByRole('navigation', { name: 'Main' })
  const box = page.getByRole('textbox', { name: 'Message the group' })
  await box.tap()
  await kb(page, true)
  await expect(tabs).toBeHidden() // keyboard up: the message bar sits on the keyboard
  // The keyboard goes away but the viewport never reports it; the box loses focus.
  await kb(page, false, false)
  await box.blur()
  await expect(tabs).toBeVisible({ timeout: 3000 })
})

test('keyboard closes without an event while the box keeps focus', async ({ page }) => {
  await setup(page)
  const tabs = page.getByRole('navigation', { name: 'Main' })
  const box = page.getByRole('textbox', { name: 'Message the group' })
  await box.tap()
  await kb(page, true)
  await expect(tabs).toBeHidden()
  // Came back to the app: the keyboard is down, the box still has focus, no resize event.
  await kb(page, false, false)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(tabs).toBeVisible({ timeout: 3000 })
})

test('opening and closing normally still works', async ({ page }) => {
  await setup(page)
  const tabs = page.getByRole('navigation', { name: 'Main' })
  await page.getByRole('textbox', { name: 'Message the group' }).tap()
  await kb(page, true)
  await expect(tabs).toBeHidden()
  await kb(page, false)
  await expect(tabs).toBeVisible()
})

test('phones that shrink the whole page for the keyboard (Android)', async ({ page }) => {
  await setup(page)
  const tabs = page.getByRole('navigation', { name: 'Main' })
  const size = page.viewportSize()!
  await page.getByRole('textbox', { name: 'Message the group' }).tap()
  await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.55) })
  await expect(tabs).toBeHidden()
  await page.setViewportSize(size)
  await expect(tabs).toBeVisible()
})
