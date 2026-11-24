/**
 * Push to the store apps:
 * - Android through Firebase Cloud Messaging (HTTP v1 API).
 * - iPhone through Apple Push Notification service, directly (token-based auth).
 *
 * Both are optional: each is used only when its credentials are set as
 * function secrets (see docs/PUSH_NOTIFICATIONS.md).
 */
import { b64urlEncode, utf8, type Bytes, type PushResult } from './webpush.ts'

export interface NativeNotification {
  title: string
  body: string
  /** In-app path to open when tapped. */
  url: string
  /** Notifications with the same tag replace each other. */
  tag: string
}

function pemToDer(pem: string): Bytes {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function signJwt(
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
  key: CryptoKey,
  algorithm: AlgorithmIdentifier | EcdsaParams,
): Promise<string> {
  const unsigned = `${b64urlEncode(utf8(JSON.stringify(header)))}.${b64urlEncode(utf8(JSON.stringify(claims)))}`
  const signature = new Uint8Array(await crypto.subtle.sign(algorithm, key, utf8(unsigned)))
  return `${unsigned}.${b64urlEncode(signature)}`
}

// ---------------------------------------------------------------------------
// Firebase Cloud Messaging (Android)
// ---------------------------------------------------------------------------

export interface FirebaseServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

let fcmToken: { value: string; expires: number } | null = null

async function fcmAccessToken(sa: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (fcmToken && fcmToken.expires > now + 60) return fcmToken.value
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    key,
    'RSASSA-PKCS1-v1_5',
  )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) throw new Error(`Firebase sign-in failed (${res.status})`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  fcmToken = { value: data.access_token, expires: now + data.expires_in }
  return data.access_token
}

export async function sendFcm(
  sa: FirebaseServiceAccount,
  deviceToken: string,
  n: NativeNotification,
): Promise<PushResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await fcmAccessToken(sa)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: n.title, body: n.body },
        data: { url: n.url },
        android: {
          priority: 'high',
          collapse_key: n.tag,
          notification: { tag: n.tag, icon: 'ic_stat_amp', color: '#d4632a', channel_id: 'group' },
        },
      },
    }),
  })
  if (res.ok) return { ok: true }
  const detail = (await res.text().catch(() => '')).slice(0, 300)
  return {
    ok: false,
    gone: res.status === 404 || detail.includes('UNREGISTERED'),
    status: res.status,
    detail,
  }
}

// ---------------------------------------------------------------------------
// Apple Push Notification service (iPhone)
// ---------------------------------------------------------------------------

export interface ApnsConfig {
  /** Contents of the .p8 key file from Apple. */
  keyP8: string
  keyId: string
  teamId: string
  bundleId: string
}

let apnsJwt: { value: string; issued: number } | null = null

async function apnsToken(cfg: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  // Apple accepts a token for up to an hour and rejects refreshing more than every 20 minutes.
  if (apnsJwt && now - apnsJwt.issued < 50 * 60) return apnsJwt.value
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(cfg.keyP8),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const value = await signJwt({ alg: 'ES256', kid: cfg.keyId }, { iss: cfg.teamId, iat: now }, key, {
    name: 'ECDSA',
    hash: 'SHA-256',
  })
  apnsJwt = { value, issued: now }
  return value
}

async function apnsSend(host: string, cfg: ApnsConfig, deviceToken: string, n: NativeNotification) {
  return fetch(`https://${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await apnsToken(cfg)}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-collapse-id': n.tag.slice(0, 64),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: { alert: { title: n.title, body: n.body }, sound: 'default', 'thread-id': 'group' },
      url: n.url,
    }),
  })
}

export async function sendApns(
  cfg: ApnsConfig,
  deviceToken: string,
  n: NativeNotification,
): Promise<PushResult> {
  // App Store and TestFlight builds use the production service; builds run
  // from Xcode use the sandbox. Try production first, then the sandbox.
  let res = await apnsSend('api.push.apple.com', cfg, deviceToken, n)
  let detail = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 300)
  if (res.status === 400 && detail.includes('BadDeviceToken')) {
    res = await apnsSend('api.sandbox.push.apple.com', cfg, deviceToken, n)
    detail = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 300)
  }
  if (res.ok) return { ok: true }
  return {
    ok: false,
    gone: res.status === 410 || detail.includes('BadDeviceToken') || detail.includes('Unregistered'),
    status: res.status,
    detail,
  }
}
