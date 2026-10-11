// lib/notifications-api.ts
// Server-only helpers for the /api/admin/notifications/* routes.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isUuid } from '@/lib/workers-api'
import { NotificationServiceError } from '@/lib/notification-service'
import {
  BROADCAST_CATEGORIES,
  BROADCAST_STATUSES,
  CUSTOM_TEMPLATE_KEY,
  DEEP_LINK_RE,
  DEFAULT_DEEP_LINK,
  DELIVERY_CHANNELS,
  DUPLICATE_LAUNCH_WINDOW_SECONDS,
  LIMITS,
  SEGMENT_TYPES,
  type BroadcastCategory,
  type DeliveryChannel,
} from '@/lib/notification-constants'
import { checkValues, getTemplate, templateKey } from '@/lib/notification-catalog'
import type {
  AudienceEstimate,
  AudienceSelection,
  CampaignListItem,
  ResolveResult,
} from '@/types/notification'

const CATEGORY_RE = /^[a-z0-9-]{1,50}$/i

// ---------- Errors ----------

export class NotificationActionError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function notificationsErrorResponse(err: unknown, tag: string) {
  if (err instanceof NotificationActionError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  if (err instanceof NotificationServiceError) {
    const status = err.status >= 500 ? 502 : err.status
    return NextResponse.json({ error: err.message, code: err.code }, { status })
  }
  const code = (err as { code?: string } | null)?.code
  if (code === '42P01' || code === '42703') {
    console.error(tag, err)
    return NextResponse.json(
      {
        error:
          'Notification tables are missing or out of date. Run notification-service migrations 003, 005 and 006 on the shared database.',
      },
      { status: 503 }
    )
  }
  console.error(tag, err)
  return NextResponse.json({ error: 'Request failed' }, { status: 500 })
}

// ---------- Parsing + validation (never trust the browser) ----------

export function parseAudience(raw: unknown): AudienceSelection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = raw as any
  const type = a?.segmentType

  if (type === 'all_users' || type === 'all_workers') return { segmentType: type }

  if (type === 'category_city') {
    const categoryId = String(a.categoryId ?? '').trim()
    const city = String(a.city ?? '').trim()
    if (!CATEGORY_RE.test(categoryId)) throw new NotificationActionError(400, 'Choose a service category')
    if (!city || city.length > 60) throw new NotificationActionError(400, 'Choose a city')
    return { segmentType: 'category_city', categoryId, city }
  }

  if (type === 'custom_ids') {
    const audience = a.audience === 'workers' ? 'workers' : a.audience === 'users' ? 'users' : null
    if (!audience) throw new NotificationActionError(400, 'Choose users or workers')
    const ids: string[] = Array.isArray(a.ids) ? [...new Set<string>(a.ids.map(String))] : []
    if (ids.length === 0) throw new NotificationActionError(400, 'Add at least one recipient')
    if (ids.length > LIMITS.specificPeople) {
      throw new NotificationActionError(400, `You can target at most ${LIMITS.specificPeople} specific people`)
    }
    if (!ids.every(isUuid)) throw new NotificationActionError(400, 'Recipient list contains an invalid ID')
    return { segmentType: 'custom_ids', audience, ids }
  }

  throw new NotificationActionError(400, 'Choose who should receive this')
}

export function parseCategory(raw: unknown): BroadcastCategory {
  if ((BROADCAST_CATEGORIES as readonly string[]).includes(String(raw))) return raw as BroadcastCategory
  throw new NotificationActionError(400, 'Choose a category: operational announcement or marketing')
}

export function parseChannels(raw: unknown): DeliveryChannel[] {
  const list = Array.isArray(raw) ? [...new Set(raw.map(String))] : []
  if (list.length === 0 || !list.every((c) => (DELIVERY_CHANNELS as readonly string[]).includes(c))) {
    throw new NotificationActionError(400, 'Choose at least one channel (push or SMS)')
  }
  return list as DeliveryChannel[]
}

function cleanText(value: unknown, label: string, max: number): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!s) throw new NotificationActionError(400, `${label} is required`)
  if (s.length > max) throw new NotificationActionError(400, `${label} must be ${max} characters or fewer`)
  if (/["\\]/.test(s)) {
    throw new NotificationActionError(400, `${label} can't contain double quotes or backslashes. Use a single quote (') instead.`)
  }
  return s
}

export function parseMessage(
  raw: unknown,
  channels: DeliveryChannel[]
): { templateKey: string; templateData: Record<string, unknown>; category: BroadcastCategory | null } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = raw as any

  if (m?.mode === 'template') {
    const t = getTemplate(String(m.templateId ?? ''))
    if (!t) throw new NotificationActionError(400, 'Unknown template')
    if (m.language !== 'en' && m.language !== 'ur') throw new NotificationActionError(400, 'Choose a language')
    const { data, errors } = checkValues(t, m.values ?? {})
    if (errors.length) throw new NotificationActionError(400, errors.join('. '))
    // The category is the template's own. The browser can't override it.
    return { templateKey: templateKey(t.id, m.language), templateData: data, category: t.category }
  }

  if (m?.mode === 'custom') {
    const title = cleanText(m.title, 'Title', LIMITS.title)
    const body = cleanText(m.body, 'Message', channels.includes('sms') ? LIMITS.smsBody : LIMITS.pushBody)
    const deepLink = String(m.deepLink ?? '').trim() || DEFAULT_DEEP_LINK
    if (!DEEP_LINK_RE.test(deepLink)) {
      throw new NotificationActionError(400, 'Deep link must look like tasklync://home')
    }
    const imageUrl = m.imageUrl && typeof m.imageUrl === 'string' && m.imageUrl.trim() ? m.imageUrl.trim() : undefined
    return {
      templateKey: CUSTOM_TEMPLATE_KEY,
      templateData: { title, body, deepLink, ...(imageUrl ? { imageUrl, image: imageUrl } : {}) },
      category: null,
    }
  }

  throw new NotificationActionError(400, 'Write a message first')
}

export function segmentFilterFor(a: AudienceSelection): Record<string, unknown> {
  switch (a.segmentType) {
    case 'category_city':
      return { category_id: a.categoryId, city: a.city }
    case 'custom_ids':
      return a.audience === 'users' ? { user_ids: a.ids } : { worker_ids: a.ids }
    default:
      return {}
  }
}

/** notification-service dedups (recipient, template_key) for 30s. A second launch inside that window would lose messages. */
export async function assertNoRecentDuplicate(templateKeyValue: string) {
  const { rows } = await db.query(
    `SELECT EXTRACT(EPOCH FROM (now() - created_at))::int AS age
     FROM broadcast_campaigns
     WHERE template_key = $1 AND created_at > now() - ($2 || ' seconds')::interval
     ORDER BY created_at DESC LIMIT 1`,
    [templateKeyValue, String(DUPLICATE_LAUNCH_WINDOW_SECONDS)]
  )
  if (rows[0]) {
    const wait = Math.max(1, DUPLICATE_LAUNCH_WINDOW_SECONDS - Number(rows[0].age))
    throw new NotificationActionError(
      429,
      `This template was launched ${rows[0].age}s ago. Wait ${wait} more seconds so the service's duplicate filter doesn't drop messages.`
    )
  }
}

// ---------- Audience SQL ----------
// These mirror the segment queries in notification-service (broadcast-resolve-and-send.job.ts).
// The service is the source of truth: the real count appears as total_recipients once the job starts.

export function segmentSql(sel: AudienceSelection): {
  sql: string
  params: unknown[]
  entity: 'user' | 'worker'
} {
  switch (sel.segmentType) {
    case 'all_users':
      return { sql: `SELECT u.id FROM users u WHERE u.deleted_at IS NULL`, params: [], entity: 'user' }
    case 'all_workers':
      return { sql: `SELECT w.id FROM workers w WHERE w.deleted_at IS NULL`, params: [], entity: 'worker' }
    case 'category_city':
      return {
        sql: `SELECT DISTINCT w.id
              FROM workers w
              JOIN worker_skills ws ON ws.worker_id = w.id
              WHERE w.deleted_at IS NULL
                AND w.verification_status::text = 'VERIFIED'
                AND ws.category_id = $1
                AND w.city = $2`,
        params: [sel.categoryId, sel.city],
        entity: 'worker',
      }
    case 'custom_ids': {
      const table = sel.audience === 'users' ? 'users' : 'workers'
      return {
        sql: `SELECT t.id FROM ${table} t WHERE t.deleted_at IS NULL AND t.id = ANY($1::uuid[])`,
        params: [sel.ids],
        entity: sel.audience === 'users' ? 'user' : 'worker',
      }
    }
  }
}

export async function estimateAudience(
  sel: AudienceSelection,
  category: BroadcastCategory
): Promise<AudienceEstimate> {
  const seg = segmentSql(sel)
  const table = seg.entity === 'user' ? 'users' : 'workers'

  const sampleRes = await db.query(
    `WITH seg AS (${seg.sql})
     SELECT t.name, t.phone FROM seg JOIN ${table} t ON t.id = seg.id
     ORDER BY t.name NULLS LAST LIMIT 5`,
    seg.params
  )
  const sample = sampleRes.rows.map((r) => ({ name: r.name as string | null, phone: r.phone as string | null }))

  // Reach = who will actually get a push/SMS, after the opt-out gates in notification-service:
  //   contact info present AND (global switch, users only) AND category preference
  //   (no preference row => provider default: marketing OFF, platform ON for push; SMS OFF for both).
  const pushDefault = category === 'marketing' ? 'false' : 'true'
  const globalPush = seg.entity === 'user' ? ' AND COALESCE(t.push_enabled, true)' : ''
  const catParam = `$${seg.params.length + 1}`

  try {
    const { rows } = await db.query(
      `WITH seg AS (${seg.sql})
       SELECT
         count(*)::int AS segment_count,
         count(*) FILTER (WHERE t.fcm_token IS NOT NULL${globalPush}
                            AND COALESCE(p.push_enabled, ${pushDefault}))::int AS push_reach,
         count(*) FILTER (WHERE t.phone IS NOT NULL
                            AND COALESCE(p.sms_enabled, false))::int AS sms_reach
       FROM seg
       JOIN ${table} t ON t.id = seg.id
       LEFT JOIN notification_preferences p
         ON p.recipient_id = t.id
        AND p.recipient_type::text = '${seg.entity}'
        AND p.category = ${catParam}`,
      [...seg.params, category]
    )
    const r = rows[0]
    return {
      entity: seg.entity,
      segmentCount: r.segment_count,
      pushReach: r.push_reach,
      smsReach: r.sms_reach,
      sample,
    }
  } catch (err) {
    // fcm_token column or notification_preferences table not there yet: fall back to the plain count.
    const code = (err as { code?: string } | null)?.code
    if (code !== '42703' && code !== '42P01') throw err
    const { rows } = await db.query(`WITH seg AS (${seg.sql}) SELECT count(*)::int AS n FROM seg`, seg.params)
    return { entity: seg.entity, segmentCount: rows[0].n, pushReach: null, smsReach: null, sample }
  }
}

/** Turns pasted phone numbers / emails / UUIDs into recipient IDs. Phones match on the last 10 digits. */
export async function resolveRecipients(
  audience: 'users' | 'workers',
  identifiers: string[]
): Promise<ResolveResult> {
  const table = audience === 'users' ? 'users' : 'workers'
  const uuids: string[] = []
  const phones: string[] = []
  const emails: string[] = []
  const notFound: string[] = []

  const parsed = identifiers.map((raw) => {
    const s = raw.trim()
    if (isUuid(s)) {
      uuids.push(s)
      return { raw, kind: 'id' as const, key: s }
    }
    if (s.includes('@')) {
      emails.push(s.toLowerCase())
      return { raw, kind: 'email' as const, key: s.toLowerCase() }
    }
    const digits = s.replace(/\D/g, '')
    if (digits.length >= 10) {
      phones.push(digits.slice(-10))
      return { raw, kind: 'phone' as const, key: digits.slice(-10) }
    }
    notFound.push(raw)
    return null
  })

  const { rows } = await db.query(
    `SELECT t.id, t.name, t.phone, t.email, t.fcm_token
     FROM ${table} t
     WHERE t.deleted_at IS NULL
       AND (
         t.id = ANY($1::uuid[])
         OR right(regexp_replace(COALESCE(t.phone, ''), '\\D', '', 'g'), 10) = ANY($2::text[])
         OR lower(COALESCE(t.email, '')) = ANY($3::text[])
       )
     LIMIT ${LIMITS.specificPeople}`,
    [uuids, phones, emails]
  )

  const ids = new Set<string>(rows.map((r) => r.id))
  const tails = new Set<string>(
    rows.map((r) => String(r.phone ?? '').replace(/\D/g, '').slice(-10)).filter(Boolean)
  )
  const mails = new Set<string>(rows.map((r) => String(r.email ?? '').toLowerCase()).filter(Boolean))

  for (const p of parsed) {
    if (!p) continue
    const hit = p.kind === 'id' ? ids.has(p.key) : p.kind === 'phone' ? tails.has(p.key) : mails.has(p.key)
    if (!hit) notFound.push(p.raw)
  }

  return {
    matched: rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      hasFcmToken: Boolean(r.fcm_token),
    })),
    notFound,
  }
}

// ---------- Campaign SQL ----------

export const CAMPAIGN_FROM_SQL = `
  FROM broadcast_campaigns c
  LEFT JOIN admin_users au ON au.id = c.created_by
`

export const CAMPAIGN_COLUMNS_SQL = `
  c.id, c.title, c.template_key, c.category::text AS category,
  c.channels::text[] AS channels, c.segment_type::text AS segment_type, c.segment_filter,
  c.status::text AS status, c.total_recipients, c.sent_count,
  c.created_by, au.full_name AS created_by_name,
  c.created_at, c.started_at, c.completed_at
`

export function buildCampaignWhere(sp: URLSearchParams) {
  const where: string[] = []
  const params: unknown[] = []
  const push = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }

  const search = (sp.get('search') || '').trim()
  const status = (sp.get('status') || 'all').toUpperCase()
  const segmentType = sp.get('segmentType') || 'all'

  if (search) {
    const p = push(`%${search}%`)
    where.push(`(c.title ILIKE ${p} OR c.template_key ILIKE ${p})`)
  }
  if ((BROADCAST_STATUSES as readonly string[]).includes(status)) {
    where.push(`c.status::text = ${push(status)}`)
  }
  if ((SEGMENT_TYPES as readonly string[]).includes(segmentType)) {
    where.push(`c.segment_type::text = ${push(segmentType)}`)
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCampaignRow(r: any): CampaignListItem {
  return {
    id: r.id,
    title: r.title,
    templateKey: r.template_key,
    category: r.category,
    channels: r.channels,
    segmentType: r.segment_type,
    segmentFilter: r.segment_filter ?? {},
    status: r.status,
    totalRecipients: r.total_recipients,
    sentCount: r.sent_count ?? 0,
    createdById: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }
}