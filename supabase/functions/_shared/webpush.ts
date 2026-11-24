/**
 * Web Push for browsers and installed web apps (Chrome, Edge, Firefox,
 * Safari on Mac, and iPhone/iPad Home Screen apps on iOS 16.4+).
 *
 * - Message encryption: RFC 8291 ("aes128gcm" content coding, RFC 8188).
 * - Server identity: VAPID, RFC 8292.
 *
 * Only WebCrypto and fetch are used, so the same code runs in Supabase Edge
 * Functions (Deno) and in the unit tests (Node).
 */

export type Bytes = Uint8Array<ArrayBuffer>

export interface WebPushSubscription {
  endpoint: string
  /** The browser's P-256 public key, base64url (65 bytes, uncompressed). */
  p256dh: string
  /** The browser's auth secret, base64url (16 bytes). */
  auth: string
}

export interface VapidKeys {
  /** base64url, 65-byte uncompressed P-256 public key. Also given to browsers when subscribing. */
  publicKey: string
  /** base64url, 32-byte P-256 private key ("d"). Secret. */
  privateKey: string
  /** A mailto: or https: URL push services can use to reach the sender. */
  subject: string
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; status: number; detail: string }

const encoder = new TextEncoder()
export const utf8 = (s: string): Bytes => encoder.encode(s) as Bytes

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Bytes {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

/** A P-256 key as JWK from its raw public point (and private scalar). */
export function p256Jwk(publicRaw: Uint8Array, privateD?: Uint8Array): JsonWebKey {
  if (publicRaw.length !== 65 || publicRaw[0] !== 4)
    throw new Error('Expected a 65-byte uncompressed P-256 key')
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(publicRaw.slice(1, 33)),
    y: b64urlEncode(publicRaw.slice(33, 65)),
    ...(privateD ? { d: b64urlEncode(privateD) } : {}),
    ext: true,
  }
}

/**
 * Encrypts `payload` for one browser (RFC 8291 §3–4). `salt` and `sender` are
 * only passed by tests, to reproduce the RFC's worked example.
 */
export async function encryptPayload(
  payload: Bytes,
  uaPublic: Bytes,
  authSecret: Bytes,
  opts: { salt?: Bytes; sender?: { publicRaw: Bytes; privateD: Bytes }; recordSize?: number } = {},
): Promise<Bytes> {
  const salt = opts.salt ?? (crypto.getRandomValues(new Uint8Array(16)) as Bytes)
  let asPublic: Bytes
  let asPrivate: CryptoKey
  if (opts.sender) {
    asPublic = opts.sender.publicRaw
    asPrivate = await crypto.subtle.importKey(
      'jwk',
      p256Jwk(opts.sender.publicRaw, opts.sender.privateD),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    )
  } else {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    asPrivate = pair.privateKey
  }

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256),
  ) as Bytes

  // HKDF, written out with HMAC to mirror the RFC's steps.
  const prkKey = await hmac(authSecret, ecdhSecret)
  const ikm = await hmac(prkKey, concat(utf8('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(utf8('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(
    0,
    16,
  )
  const nonce = (await hmac(prk, concat(utf8('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // One record: the payload followed by the 0x02 "last record" delimiter.
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))),
  )

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, opts.recordSize ?? 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** The VAPID Authorization header for one push service (RFC 8292 §2–3). */
export async function vapidAuthorization(
  endpoint: string,
  vapid: VapidKeys,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = b64urlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 12 * 60 * 60, sub: vapid.subject })),
  )
  const key = await crypto.subtle.importKey(
    'jwk',
    p256Jwk(b64urlDecode(vapid.publicKey), b64urlDecode(vapid.privateKey)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${header}.${claims}`)),
  )
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${vapid.publicKey}`
}

/** Sends one encrypted push. `gone` means the subscription no longer exists and should be deleted. */
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: string,
  vapid: VapidKeys,
  opts: { ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string } = {},
): Promise<PushResult> {
  const body = await encryptPayload(
    utf8(payload),
    b64urlDecode(subscription.p256dh),
    b64urlDecode(subscription.auth),
  )
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(subscription.endpoint, vapid),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opts.ttlSeconds ?? 24 * 60 * 60),
    Urgency: opts.urgency ?? 'normal',
  }
  // Pending pushes with the same topic replace each other (only the latest is delivered).
  if (opts.topic) headers.Topic = opts.topic
  const res = await fetch(subscription.endpoint, { method: 'POST', headers, body })
  if (res.ok) return { ok: true }
  return {
    ok: false,
    gone: res.status === 404 || res.status === 410,
    status: res.status,
    detail: (await res.text().catch(() => '')).slice(0, 300),
  }
}
