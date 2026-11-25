import { useSyncExternalStore } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNative } from './native'

/**
 * Whether the on-screen keyboard is open, shared by everything that asks.
 *
 * While it's open the tab bar steps aside and the group's message bar sits
 * on the keyboard, so getting "open" stuck would leave people with nothing
 * but the message bar. Phones don't always report the keyboard closing
 * (iPhones especially, after switching apps or locking the screen), so this
 * never relies on one signal: the keyboard only counts as open while a text
 * field has focus AND the screen has room for a keyboard taken out of it,
 * and both are checked again whenever focus moves, the screen changes size,
 * or the app comes back to the screen.
 */

/** Below this share of the full height, something (the keyboard) is covering the screen. */
const KEYBOARD_SHARE = 0.75

let open = false
let nativeShown = false
/** The screen's size with no text field focused (no keyboard). */
let full = { width: 0, height: 0 }
let recheck: number | undefined
const listeners = new Set<() => void>()

function typingField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true
  return (
    el instanceof HTMLInputElement &&
    !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'].includes(
      el.type,
    )
  )
}

const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight

function set(next: boolean) {
  if (next === open) return
  open = next
  listeners.forEach((l) => l())
  // While "open", keep checking in case the phone never says it closed.
  window.clearInterval(recheck)
  recheck = open ? window.setInterval(measure, 1500) : undefined
}

function measure() {
  const typing = typingField(document.activeElement)
  if (!typing) {
    // No keyboard now, so this is the screen's full size.
    full = { width: window.innerWidth, height: Math.max(window.innerHeight, viewportHeight()) }
    set(false)
    return
  }
  if (isNative) {
    set(nativeShown)
    return
  }
  // Some browsers shrink the page with the keyboard and some only the
  // visual viewport, so compare with the keyboard-free height. A keyboard
  // never changes the width; turning the phone does, and then the old
  // height no longer applies.
  const fullHeight =
    full.width === window.innerWidth ? Math.max(full.height, window.innerHeight) : window.innerHeight
  set(viewportHeight() < fullHeight * KEYBOARD_SHARE)
}

// Focus moves through blur before landing on the next field.
const measureSoon = () => window.setTimeout(measure, 60)

let started = false
function start() {
  if (started || typeof window === 'undefined') return
  started = true
  full = { width: window.innerWidth, height: Math.max(window.innerHeight, viewportHeight()) }
  document.addEventListener('focusin', measureSoon)
  document.addEventListener('focusout', measureSoon)
  document.addEventListener('visibilitychange', measure)
  window.addEventListener('pageshow', measure)
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', measureSoon)
  window.visualViewport?.addEventListener('resize', measure)
  if (isNative) {
    void Keyboard.addListener('keyboardWillShow', () => {
      nativeShown = true
      measure()
    })
    void Keyboard.addListener('keyboardWillHide', () => {
      nativeShown = false
      measure()
    })
  }
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True while the on-screen keyboard is open (native apps and mobile browsers). */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  )
}
