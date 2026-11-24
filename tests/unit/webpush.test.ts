// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  b64urlDecode,
  b64urlEncode,
  concat,
  encryptPayload,
  p256Jwk,
  utf8,
  vapidAuthorization,
  type Bytes,
} from '../../supabase/functions/_shared/webpush'

// RFC 8291 §5 worked example.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

/** What a browser does on receipt: decrypt with its private key (RFC 8291 §3). */
async function decrypt(body: Bytes, uaPublic: Bytes, uaPrivateD: Bytes, authSecret: Bytes): Promise<string> {
  const salt = body.slice(0, 16)
  const idlen = body[20]!
  const asPublic = body.slice(21, 21 + idlen)
  const ciphertext = body.slice(21 + idlen)
  const hmac = async (key: Bytes, data: Bytes) =>
    new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
        data,
      ),
    ) as Bytes
  const priv = await crypto.subtle.importKey(
    'jwk',
    p256Jwk(uaPublic, uaPrivateD),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
  const pub = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256),
  ) as Bytes
  const ikm = await hmac(
    await hmac(authSecret, secret),
    concat(utf8('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])),
  )
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(utf8('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(
    0,
    16,
  )
  const nonce = (await hmac(prk, concat(utf8('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  expect(padded[padded.length - 1]).toBe(2)
  return new TextDecoder().decode(padded.slice(0, -1))
}

describe('web push encryption (RFC 8291)', () => {
  it('reproduces the RFC 8291 worked example byte for byte', async () => {
    const body = await encryptPayload(
      utf8(RFC.plaintext),
      b64urlDecode(RFC.uaPublic),
      b64urlDecode(RFC.authSecret),
      {
        salt: b64urlDecode(RFC.salt),
        sender: { publicRaw: b64urlDecode(RFC.asPublic), privateD: b64urlDecode(RFC.asPrivate) },
      },
    )
    expect(b64urlEncode(body)).toBe(RFC.body)
  })

  it('round-trips with a fresh key and salt each time', async () => {
    const message = JSON.stringify({ title: 'AMP', body: 'New message in your group' })
    const a = await encryptPayload(utf8(message), b64urlDecode(RFC.uaPublic), b64urlDecode(RFC.authSecret))
    const b = await encryptPayload(utf8(message), b64urlDecode(RFC.uaPublic), b64urlDecode(RFC.authSecret))
    expect(b64urlEncode(a)).not.toBe(b64urlEncode(b))
    const plain = await decrypt(
      a,
      b64urlDecode(RFC.uaPublic),
      b64urlDecode(RFC.uaPrivate),
      b64urlDecode(RFC.authSecret),
    )
    expect(plain).toBe(message)
  })
})

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT for the push service origin that verifies with the public key', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const vapid = { publicKey: b64urlEncode(publicRaw), privateKey: jwk.d!, subject: 'https://example.org' }
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc123', vapid, 1_000_000)
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)
    expect(match).not.toBeNull()
    const [, h, c, s, k] = match!
    expect(k).toBe(vapid.publicKey)
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h!)))).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c!)))).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_000_000 + 12 * 3600,
      sub: 'https://example.org',
    })
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      b64urlDecode(s!),
      utf8(`${h}.${c}`),
    )
    expect(ok).toBe(true)
  })
})
