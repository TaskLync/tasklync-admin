// lib/verification-api.ts
// Server-only helpers for the /api/admin/workers/verification/* routes.
import { NextResponse } from 'next/server'
import type { PoolClient } from 'pg'
import { db } from '@/lib/db'
import { CATEGORY_NAMES_SQL } from '@/lib/workers-api'
import { QUEUE_TABS, type QueueTab } from '@/lib/verification-constants'

const CATEGORY_RE = /^[a-z0-9-]{1,50}$/i

// ---------- Errors + transactions ----------

export class VerificationError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export function errorResponse(err: unknown, tag: string) {
  if (err instanceof VerificationError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(tag, err)
  return NextResponse.json({ error: 'Action failed' }, { status: 500 })
}

// ---------- Outbox ----------

/** Writes a Kafka-bound event inside the caller's transaction. */
export async function enqueueEvent(
  client: PoolClient,
  params: { topic: string; eventType: string; workerId: string; data: Record<string, unknown> }
) {
  const payload = {
    event_type: params.eventType,
    worker_id: params.workerId,
    timestamp: new Date().toISOString(),
    data: params.data,
  }
  await client.query(
    `INSERT INTO admin_event_outbox (topic, event_type, event_key, payload)
     VALUES ($1, $2, $3, $4)`,
    [params.topic, params.eventType, params.workerId, JSON.stringify(payload)]
  )
}

// ---------- CNIC ----------

export const CNIC_DUPLICATES_SQL = `
  SELECT id, name, phone, lower(verification_status::text) AS verification_status
  FROM workers
  WHERE cnic_number = $1 AND id <> $2 AND deleted_at IS NULL
  ORDER BY created_at
`

// ---------- Queue SQL ----------
// One CTE shared by list + counts so they can never disagree.
// The WHERE keeps the working set small: only workers awaiting review plus
// anyone decided in the last 30 days (the Approved / Rejected tabs).

export const QUEUE_BASE_CTE = `
  WITH q AS (
    SELECT
      w.id, w.name, w.phone, w.city, w.avatar_url,
      lower(w.verification_status::text) AS verification_status,
      ${CATEGORY_NAMES_SQL} AS categories,
      COALESCE(docs.waiting_since, w.updated_at) AS submitted_at,
      COALESCE(docs.pending_docs, 0) AS pending_docs,
      COALESCE(docs.total_docs, 0)   AS total_docs,
      lr.decision     AS last_decision,
      lr.reason_code  AS last_reason_code,
      lr.note         AS last_note,
      lr.admin_email  AS last_admin_email,
      lr.created_at   AS last_decision_at,
      (
        w.reverification_requested_at IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM worker_verification_reviews rr
          WHERE rr.worker_id = w.id AND rr.decision = 'rejected'
        )
      ) AS is_resubmission
    FROM workers w
    LEFT JOIN LATERAL (
      SELECT
        min(d.created_at) FILTER (WHERE d.status = 'PENDING')  AS waiting_since,
        (count(*) FILTER (WHERE d.status = 'PENDING'))::int    AS pending_docs,
        count(*)::int                                          AS total_docs
      FROM worker_documents d
      WHERE d.worker_id = w.id
    ) docs ON true
    LEFT JOIN LATERAL (
      SELECT r.decision, r.reason_code, r.note, r.admin_email, r.created_at
      FROM worker_verification_reviews r
      WHERE r.worker_id = w.id
      ORDER BY r.created_at DESC
      LIMIT 1
    ) lr ON true
    WHERE w.deleted_at IS NULL
      AND (
        w.verification_status = 'PENDING_REVIEW'
        OR EXISTS (
          SELECT 1 FROM worker_verification_reviews x
          WHERE x.worker_id = w.id AND x.created_at >= now() - interval '30 days'
        )
      )
  )
`

export const TAB_SQL: Record<QueueTab, string> = {
  pending: `verification_status = 'pending_review' AND NOT is_resubmission`,
  resubmitted: `verification_status = 'pending_review' AND is_resubmission`,
  approved: `verification_status = 'verified' AND last_decision = 'approved'
             AND last_decision_at >= now() - interval '30 days'`,
  rejected: `verification_status = 'rejected' AND last_decision = 'rejected'
             AND last_decision_at >= now() - interval '30 days'`,
}

// Pending tabs: oldest first (longest waiting on top). Decided tabs: newest first.
export const TAB_ORDER: Record<QueueTab, string> = {
  pending: 'submitted_at ASC, id',
  resubmitted: 'submitted_at ASC, id',
  approved: 'last_decision_at DESC, id',
  rejected: 'last_decision_at DESC, id',
}

export function parseTab(value: string | null): QueueTab {
  return (QUEUE_TABS as readonly string[]).includes(value ?? '') ? (value as QueueTab) : 'pending'
}

/** Returns " AND ..." fragments + params for the optional filters. */
export function buildQueueFilters(sp: URLSearchParams): { filterSql: string; params: unknown[] } {
  const parts: string[] = []
  const params: unknown[] = []
  const push = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }

  const search = (sp.get('search') || '').trim()
  const city = sp.get('city') || 'all'
  const categoryId = sp.get('categoryId') || 'all'

  if (search) {
    const p = push(`%${search}%`)
    parts.push(`(q.name ILIKE ${p} OR q.phone ILIKE ${p})`)
  }
  if (city !== 'all') {
    parts.push(`q.city = ${push(city)}`)
  }
  if (categoryId !== 'all' && CATEGORY_RE.test(categoryId)) {
    parts.push(
      `EXISTS (SELECT 1 FROM worker_skills ws WHERE ws.worker_id = q.id AND ws.category_id = ${push(categoryId)})`
    )
  }

  return { filterSql: parts.length ? ` AND ${parts.join(' AND ')}` : '', params }
}