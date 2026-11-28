/*
 * AMP push notifications. Imported by the generated service worker
 * (vite.config.ts → workbox.importScripts), so it runs in the background and
 * shows notifications even when AMP is closed.
 *
 * Payload (from supabase/functions/_shared/groupNotification.ts):
 *   { title, body, url, tag, discreet, stack? }
 */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const tag = data.tag || 'amp-group'
  const url = data.url || '/group'

  event.waitUntil(
    (async () => {
      let body = data.body || 'New message in your group'
      let count = 1
      // Only notifications that ask for it (group messages, join requests)
      // stack into a count: "3 new messages in your group". Others, like
      // check-in and meeting reminders, just replace the earlier one with
      // the same tag.
      const stack = data.stack || ''
      if (stack) {
        const existing = await self.registration.getNotifications({ tag })
        count = existing.reduce((n, x) => Math.max(n, (x.data && x.data.count) || 1), 0) + 1
        if (count > 1) body = stack.replace('{n}', String(count))
      }
      await self.registration.showNotification(data.title || 'AMP', {
        body,
        tag,
        renotify: true,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        data: { url, count },
      })
      // The red number on the app icon (installed apps that support it).
      if (self.navigator.setAppBadge) {
        const shown = await self.registration.getNotifications()
        const total = shown.reduce((n, x) => n + ((x.data && x.data.count) || 1), 0)
        await self.navigator.setAppBadge(total).catch(() => {})
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = (event.notification.data && event.notification.data.url) || '/group'
  const target = new URL(path, self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        // The app routes itself (no reload); see PushBridge in src/app/AppShell.tsx.
        open.postMessage({ type: 'amp-open', url: path })
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
