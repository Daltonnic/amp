import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

/**
 * Requests carry the user's access token in the Authorization header (no
 * cookies), so a permissive CORS origin does not open a CSRF hole. Restrict it
 * with ALLOWED_ORIGINS (comma-separated) if you prefer.
 */
const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : (allowed[0] ?? '')
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required secret: ${name}`)
  return value
}

/** Service-role client: bypasses RLS. Only ever used server-side. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface AuthedRequest {
  user: User
  /** Client acting as the user, so Row Level Security applies to its queries. */
  userClient: SupabaseClient
}

/** Verifies the caller's access token. Returns null when it is missing or invalid. */
export async function authenticate(req: Request): Promise<AuthedRequest | null> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const userClient = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) return null
  return { user: data.user, userClient }
}

/** Counts rows in `table` for this user since `sinceMs` ago (service role). */
export async function countRecent(
  admin: SupabaseClient,
  table: 'outbound_emails' | 'ai_usage',
  userId: string,
  sinceMs: number,
): Promise<number> {
  const since = new Date(Date.now() - sinceMs).toISOString()
  const { count, error } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)
  if (error) throw error
  return count ?? 0
}

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR
