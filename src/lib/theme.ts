import { useCallback, useEffect, useState } from 'react'
import { SystemBars, SystemBarsStyle } from '@capacitor/core'
import { isNative } from './native'

export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'amp.theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function apply(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  const color = dark ? '#0d1526' : '#f3f4f7'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
  // Light status-bar text on dark backgrounds and vice versa (iOS + Android edge-to-edge).
  if (isNative) {
    void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }
}

/** Applies the saved theme and keeps following the OS when set to "system". */
export function initTheme() {
  apply(readPreference())
  media().addEventListener('change', () => {
    if (readPreference() === 'system') apply('system')
  })
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>(readPreference)
  useEffect(() => apply(pref), [pref])
  const update = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage unavailable: still apply for this session */
    }
    setPref(next)
  }, [])
  return [pref, update] as const
}
