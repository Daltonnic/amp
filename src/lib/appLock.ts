import { Preferences } from '@capacitor/preferences'
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth'
import { isNative } from './native'

/**
 * App lock (Settings → Privacy & Security → PIN Lock).
 *
 * The original app saved the PIN in plain text to the database and never
 * asked for it. Here the PIN never leaves the device: only a salted
 * PBKDF2-SHA256 hash is kept, in on-device storage. On iOS/Android, Face ID /
 * Touch ID / fingerprint can unlock instead of typing the PIN.
 */

const KEY = 'amp.applock'
const ITERATIONS = 210_000
/** Lock again after the app has been in the background this long. */
export const RELOCK_AFTER_MS = 30_000

export interface LockConfig {
  pinHash: string
  salt: string
  biometrics: boolean
}

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')

const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [])

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

export async function getLockConfig(): Promise<LockConfig | null> {
  try {
    const { value } = await Preferences.get({ key: KEY })
    return value ? (JSON.parse(value) as LockConfig) : null
  } catch {
    return null
  }
}

export async function setPin(pin: string, biometrics: boolean): Promise<void> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4–6 digits.')
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const config: LockConfig = { pinHash: await hashPin(pin, salt), salt, biometrics }
  await Preferences.set({ key: KEY, value: JSON.stringify(config) })
}

export async function setBiometrics(enabled: boolean): Promise<void> {
  const config = await getLockConfig()
  if (!config) return
  await Preferences.set({ key: KEY, value: JSON.stringify({ ...config, biometrics: enabled }) })
}

export async function clearLock(): Promise<void> {
  await Preferences.remove({ key: KEY })
}

/** Constant-time comparison of two hex strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPin(pin: string): Promise<boolean> {
  const config = await getLockConfig()
  if (!config) return true
  return safeEqual(await hashPin(pin, config.salt), config.pinHash)
}

export interface BiometryInfo {
  available: boolean
  label: string
}

export async function biometryInfo(): Promise<BiometryInfo> {
  if (!isNative) return { available: false, label: '' }
  try {
    const result = await BiometricAuth.checkBiometry()
    const label =
      result.biometryType === BiometryType.faceId
        ? 'Face ID'
        : result.biometryType === BiometryType.touchId
          ? 'Touch ID'
          : result.biometryType === BiometryType.fingerprintAuthentication
            ? 'Fingerprint'
            : 'Biometrics'
    return { available: result.isAvailable, label }
  } catch {
    return { available: false, label: '' }
  }
}

/** Prompts for Face ID / Touch ID / fingerprint. Resolves true on success. */
export async function unlockWithBiometrics(): Promise<boolean> {
  if (!isNative) return false
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock AMP',
      cancelTitle: 'Use PIN',
      allowDeviceCredential: false,
      androidTitle: 'Unlock AMP',
      androidSubtitle: 'Use your fingerprint or face',
    })
    return true
  } catch {
    return false
  }
}
