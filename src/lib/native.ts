import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web'

/** Light tap feedback for selections (no-op on the web). */
export function hapticTap() {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

export function hapticSuccess() {
  if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => {})
}

export function hapticWarning() {
  if (isNative) void Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
}

/** Running as an installed PWA (home-screen app) rather than in a browser tab. */
export function isStandalonePwa(): boolean {
  if (isNative) return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
