#!/usr/bin/env node
/**
 * Imports data exported from Base44 into Supabase.
 *
 * 1. In Base44: Dashboard → Data → open each table → Export (CSV or JSON).
 *    Save the files into one folder, named after the entity:
 *      UserProfile.csv  CheckIn.csv  JournalEntry.csv  TriggerLog.csv
 *      GroundingSession.csv  AccountabilityContact.csv  LibraryArticle.csv
 * 2. Run (service-role key: Supabase → Project Settings → API keys):
 *      SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *        npm run import:base44 -- ./base44-export            # dry run
 *      ... npm run import:base44 -- ./base44-export --apply  # write
 *
 * Each Base44 record's `created_by` email becomes a Supabase user (created if
 * needed, already confirmed). Sign-in uses emailed codes, so people simply
 * sign in with the same email and find their history. Re-running is safe:
 * rows are keyed by their Base44 id and skipped if already imported.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { parseCsv } from './lib/csv.mjs'

const args = process.argv.slice(2)
const dir = args.find((a) => !a.startsWith('--'))
const apply = args.includes('--apply')
if (!dir) {
  console.error('Usage: node scripts/import-base44.mjs <export-folder> [--apply]')
  process.exit(1)
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function load(entity) {
  for (const ext of ['json', 'csv']) {
    const file = path.join(dir, `${entity}.${ext}`)
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const records = ext === 'json' ? JSON.parse(text) : parseCsv(text)
    return Array.isArray(records) ? records : (records.items ?? records.data ?? [])
  }
  return null
}

const str = (v, max = 100000) => (v === null || v === undefined ? '' : String(v)).slice(0, max)
const int = (v, lo = 1, hi = 10) => {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null
}
const bool = (v, fallback = false) =>
  v === true || v === 'true' || v === 'TRUE' || v === '1'
    ? true
    : v === false || v === 'false' || v === 'FALSE' || v === '0'
      ? false
      : fallback
const date = (v) => (v ? new Date(v).toISOString() : new Date().toISOString())
const track = (v) => (v === 'spouse' ? 'spouse' : 'men')
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const list = (v) => {
  if (Array.isArray(v)) return v.map(String)
  const s = str(v).trim()
  if (s.startsWith('[')) {
    try {
      return JSON.parse(s).map(String)
    } catch {
      /* fall through */
    }
  }
  return s
    ? s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : []
}

/** Deterministic UUID from a Base44 id, so re-runs don't duplicate rows. */
function uuidFrom(base44Id, entity) {
  const h = crypto.createHash('sha256').update(`${entity}:${base44Id}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const userIds = new Map()

async function loadExistingUsers() {
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) if (u.email) userIds.set(u.email.toLowerCase(), u.id)
    if (data.users.length < 1000) break
  }
}

async function userFor(email) {
  const key = str(email).trim().toLowerCase()
  if (!key) return null
  if (userIds.has(key)) return userIds.get(key)
  if (!apply) {
    userIds.set(key, `dry-run:${key}`)
    return userIds.get(key)
  }
  const { data, error } = await sb.auth.admin.createUser({ email: key, email_confirm: true })
  if (error) throw new Error(`Could not create user ${key}: ${error.message}`)
  userIds.set(key, data.user.id)
  return data.user.id
}

// ---------------------------------------------------------------------------
// Entity mappings (Base44 field names → Supabase columns)
// ---------------------------------------------------------------------------

const ENTITIES = [
  {
    entity: 'UserProfile',
    table: 'profiles',
    conflict: 'user_id',
    map: (r) => ({
      track: track(r.track),
      reason: str(r.reason, 5000),
      primary_needs: list(r.primary_need).slice(0, 3),
      display_name: str(r.display_name, 80),
      daily_reminders: bool(r.daily_reminders, true),
      onboarding_complete: bool(r.onboarding_complete, true),
      // pin_code is intentionally NOT imported: it was stored in plain text.
    }),
  },
  {
    entity: 'CheckIn',
    table: 'check_ins',
    map: (r) => ({
      track: track(r.track),
      date: str(r.date).slice(0, 10) || date(r.created_date).slice(0, 10),
      emotions: str(r.emotional_state, 80) ? [str(r.emotional_state, 80)] : [],
      custom_emotion: str(r.custom_emotion, 200),
      intensity: track(r.track) === 'spouse' ? int(r.intensity) : null,
      temptation_level: track(r.track) === 'men' ? int(r.temptation_level) : null,
      stress_level: track(r.track) === 'men' ? int(r.stress_level) : null,
      recent_triggers: str(r.recent_triggers, 10000),
      spiritual_condition: str(r.spiritual_condition, 40),
      honesty_check: str(r.honesty_check, 10000),
      next_step: str(r.next_step, 10000),
      body_awareness: str(r.body_awareness, 40),
      primary_fear: str(r.primary_fear, 10000),
      current_need: str(r.current_need, 40),
      reflection: str(r.reflection, 10000),
    }),
  },
  {
    entity: 'JournalEntry',
    table: 'journal_entries',
    skip: (r) => !str(r.content).trim(),
    map: (r) => ({
      track: r.track ? track(r.track) : null,
      title: str(r.title, 200),
      content: str(r.content),
      category: str(r.category, 60) || 'free_writing',
      prompt_used: str(r.prompt_used, 500),
      updated_at: date(r.updated_date || r.created_date),
    }),
  },
  {
    entity: 'TriggerLog',
    table: 'trigger_logs',
    skip: (r) => !str(r.emotional_state).trim(),
    map: (r) => ({
      emotional_state: str(r.emotional_state, 80),
      trigger_type: oneOf(
        r.trigger_type,
        ['visual', 'emotional', 'relational', 'situational', 'spiritual', 'physical', 'digital', 'other'],
        'other',
      ),
      intensity: int(r.intensity) ?? 5,
      event_description: str(r.event_description, 10000),
      thoughts: str(r.thoughts, 10000),
      physical_sensations: str(r.physical_sensations, 10000),
      response_pattern: oneOf(
        r.response_pattern,
        ['', 'healthy_coping', 'avoidance', 'acting_out', 'isolation', 'reaching_out', 'grounding', 'other'],
        '',
      ),
      healthy_next_step: str(r.healthy_next_step, 10000),
    }),
  },
  {
    entity: 'GroundingSession',
    table: 'grounding_sessions',
    map: (r) => ({
      type: oneOf(
        r.type,
        [
          'breathing',
          'body_grounding',
          'orienting',
          'prayer',
          'truth_reminder',
          'scripture',
          'reassurance',
          'guide',
        ],
        'breathing',
      ),
    }),
  },
  {
    entity: 'AccountabilityContact',
    table: 'accountability_contacts',
    skip: (r) => !str(r.name).trim(),
    map: (r) => {
      const email = str(r.email, 254).trim()
      return {
        name: str(r.name, 120),
        email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '',
        phone: str(r.phone, 40),
        relationship: str(r.relationship, 80),
      }
    },
  },
  {
    entity: 'LibraryArticle',
    table: 'library_articles',
    shared: true,
    skip: (r) => !str(r.title).trim() || !str(r.content).trim(),
    map: (r) => ({
      title: str(r.title),
      content: str(r.content),
      category: oneOf(
        r.category,
        [
          'scripture_teaching',
          'recovery',
          'emotional_health',
          'spiritual_formation',
          'spouse_support',
          'identity',
          'accountability',
        ],
        'recovery',
      ),
      track: oneOf(r.track, ['men', 'spouse', 'both'], 'both'),
      scripture_reference: str(r.scripture_reference),
      read_time_minutes: int(r.read_time_minutes, 1, 600),
      tags: Array.isArray(r.tags) ? r.tags.join(', ') : str(r.tags),
      featured: bool(r.featured),
      published: r.published === undefined || r.published === '' ? true : bool(r.published, true),
      updated_at: date(r.updated_date || r.created_date),
    }),
  },
]

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`${apply ? 'IMPORTING' : 'DRY RUN (add --apply to write)'} from ${path.resolve(dir)}\n`)
await loadExistingUsers()

for (const spec of ENTITIES) {
  const records = load(spec.entity)
  if (!records) {
    console.log(`- ${spec.entity}: no export file found, skipped`)
    continue
  }
  const rows = []
  let skipped = 0
  for (const r of records) {
    if (spec.skip?.(r)) {
      skipped++
      continue
    }
    const row = {
      id: uuidFrom(r.id ?? JSON.stringify(r), spec.entity),
      ...spec.map(r),
      created_at: date(r.created_date),
    }
    if (!spec.shared) {
      const userId = await userFor(r.created_by ?? r.created_by_email)
      if (!userId) {
        skipped++
        continue
      }
      row.user_id = userId
    }
    rows.push(row)
  }
  if (spec.table === 'profiles') {
    // One profile per user: keep the most recent.
    const latest = new Map()
    for (const row of rows)
      if (!latest.has(row.user_id) || latest.get(row.user_id).created_at < row.created_at)
        latest.set(row.user_id, row)
    rows.splice(0, rows.length, ...latest.values())
  }
  console.log(
    `- ${spec.entity} → ${spec.table}: ${rows.length} rows${skipped ? ` (${skipped} skipped: empty or no owner)` : ''}`,
  )
  if (!apply || rows.length === 0) continue
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb
      .from(spec.table)
      .upsert(rows.slice(i, i + 500), { onConflict: spec.conflict ?? 'id', ignoreDuplicates: true })
    if (error) throw new Error(`${spec.table}: ${error.message}`)
  }
}

console.log(`\nUsers referenced: ${userIds.size}. ${apply ? 'Done.' : 'Nothing was written.'}`)
