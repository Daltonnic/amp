import { beforeEach, describe, expect, it } from 'vitest'
import { clearLock, getLockConfig, hashPin, isValidPin, setPin, verifyPin } from '@/lib/appLock'

describe('app lock', () => {
  beforeEach(async () => {
    await clearLock()
  })

  it('accepts only 4–6 digit PINs', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('1234567')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })

  it('hashes deterministically per salt, differently across salts', async () => {
    const a = await hashPin('2468', '00112233445566778899aabbccddeeff')
    const b = await hashPin('2468', '00112233445566778899aabbccddeeff')
    const c = await hashPin('2468', 'ffeeddccbbaa99887766554433221100')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never stores the PIN itself', async () => {
    await setPin('2468', false)
    const config = await getLockConfig()
    expect(config).not.toBeNull()
    expect(JSON.stringify(config)).not.toContain('2468')
  })

  it('verifies the right PIN and rejects the wrong one', async () => {
    await setPin('2468', false)
    expect(await verifyPin('2468')).toBe(true)
    expect(await verifyPin('1357')).toBe(false)
  })

  it('treats "no lock configured" as unlocked', async () => {
    expect(await getLockConfig()).toBeNull()
    expect(await verifyPin('anything')).toBe(true)
  })
})
