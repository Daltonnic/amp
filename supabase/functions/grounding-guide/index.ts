/**
 * grounding-guide
 *
 * Replaces the Base44 agent `grounding_guide` used on the Trigger Awareness
 * screen. Stateless: the app sends the conversation so far, this function
 * streams the next reply back as plain text. Conversations are not stored.
 *
 * Secrets: ANTHROPIC_API_KEY
 * Optional: GROUNDING_GUIDE_MODEL (default claude-opus-5-5),
 *           GROUNDING_GUIDE_EFFORT (low | medium | high; default low)
 */
import Anthropic from 'npm:@anthropic-ai/sdk@1.12.0'
import {
  adminClient,
  authenticate,
  corsHeaders,
  countRecent,
  DAY,
  HOUR,
  json,
  requireEnv,
} from '../_shared/http.ts'
import { systemPrompt } from './prompt.ts'

const LIMIT_PER_HOUR = 60
const LIMIT_PER_DAY = 200
const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 4000

const MODEL = Deno.env.get('GROUNDING_GUIDE_MODEL') || 'claude-opus-5-5'
// Chat in a moment of distress is latency-sensitive; `low` effort keeps
// replies quick. Raise it with GROUNDING_GUIDE_EFFORT if you want more depth.
const EFFORT = (Deno.env.get('GROUNDING_GUIDE_EFFORT') || 'low') as 'low' | 'medium' | 'high'

const REFUSAL_TEXT =
  "\n\nI'm not able to continue this conversation here. Please try one of the grounding tools, " +
  'or reach out to your accountability contact or someone you trust right now. ' +
  'If you are in danger or thinking about harming yourself, call or text 988 (in the U.S.) or your local emergency number.'

type Message = Anthropic.Beta.BetaMessageParam

function validate(messages: unknown): Message[] | null {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null
  const out: Message[] = []
  for (const [i, m] of messages.entries()) {
    if (typeof m !== 'object' || m === null) return null
    const { role, content } = m as { role?: unknown; content?: unknown }
    const expected = i % 2 === 0 ? 'user' : 'assistant'
    if (role !== expected || typeof content !== 'string') return null
    const text = content.trim()
    if (!text || text.length > MAX_MESSAGE_CHARS) return null
    out.push({ role: expected, content: text })
  }
  return out.at(-1)?.role === 'user' ? out : null
}

const anthropic = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  const auth = await authenticate(req)
  if (!auth) return json(req, 401, { error: 'Please sign in again.' })

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown }
  const messages = validate(body.messages)
  if (!messages) {
    return json(req, 400, {
      error: 'This conversation is too long to continue. Please close it and start a new grounding session.',
    })
  }

  const admin = adminClient()
  try {
    const [lastHour, lastDay] = await Promise.all([
      countRecent(admin, 'ai_usage', auth.user.id, HOUR),
      countRecent(admin, 'ai_usage', auth.user.id, DAY),
    ])
    if (lastHour >= LIMIT_PER_HOUR || lastDay >= LIMIT_PER_DAY) {
      return json(req, 429, {
        error:
          "You've reached today's limit for the Grounding Guide. The grounding tools are always available.",
      })
    }
  } catch (err) {
    console.error(err)
    return json(req, 500, { error: 'Something went wrong. Please try again.' })
  }

  const { data: profile } = await auth.userClient.from('profiles').select('track').maybeSingle()
  const track = profile?.track === 'spouse' ? 'spouse' : 'men'
  await admin.from('ai_usage').insert({ user_id: auth.user.id })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = anthropic.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 16000,
            output_config: { effort: EFFORT },
            // On a safety-classifier decline, the API retries on a
            // recommended fallback model within the same stream.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            cache_control: { type: 'ephemeral' },
            system: systemPrompt(track),
            messages,
          },
          { signal: req.signal },
        )
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        const final = await response.finalMessage()
        if (final.stop_reason === 'refusal') controller.enqueue(encoder.encode(REFUSAL_TEXT))
        controller.close()
      } catch (err) {
        if (err instanceof Anthropic.APIUserAbortError) {
          controller.close()
          return
        }
        console.error(err)
        controller.enqueue(
          encoder.encode('\n\nSorry — I lost my connection for a moment. Please send your message again.'),
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
