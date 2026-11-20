/**
 * delete-account
 *
 * Permanently deletes the caller's auth user. Every personal table references
 * auth.users with ON DELETE CASCADE, so all check-ins, journal entries,
 * trigger logs, grounding sessions, contacts and the profile go with it.
 * Required by App Store Review Guideline 5.1.1(v) and Google Play's
 * account-deletion policy.
 */
import { adminClient, authenticate, corsHeaders, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  try {
    const auth = await authenticate(req)
    if (!auth) return json(req, 401, { error: 'Please sign in again.' })

    const { error } = await adminClient().auth.admin.deleteUser(auth.user.id)
    if (error) throw error
    return json(req, 200, { ok: true })
  } catch (err) {
    console.error(err)
    return json(req, 500, { error: "We couldn't delete your account. Please try again." })
  }
})
