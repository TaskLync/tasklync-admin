// lib/disputes-api.ts
// Server-only helpers for the /api/admin/disputes/* routes.
import { NextResponse } from 'next/server'
import { CITY_SQL, bookingErrorResponse } from '@/lib/bookings-api'
import {
  ADMIN_OPENED_PREFIX,
  DISPUTE_RESOLUTIONS,
  DISPUTE_TABS,
  RESOLVED_WINDOW_DAYS,
  RESPONSE_WINDOW_HOURS,
  type DisputeTab,
} from '@/lib/dispute-constants'
import type { DisputeListItem } from '@/types/dispute'

// Same transaction + outbox helpers the booking actions use.
export {
  enqueueBookingEvent,
  enqueueNotification,
  lockBooking,
  setActor,
  withTx,
} from '@/lib/bookings-api'

const CATEGORY_RE = /^[a-z0-9-]{1,50}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ---------- Errors ----------

export class DisputeActionError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const disputeNotFound = () =>
  NextResponse.json({ error: 'Dispute not found' }, { status: 404 })

export function disputeErrorResponse(err: unknown, tag: string) {
  if (err instanceof DisputeActionError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const code = (err as { code?: string } | null)?.code
  if (code === '42P01' || code === '42703') {
    console.error(tag, err)
    return NextResponse.json(
      { error: 'Dispute tables are out of date. Run db/migrations/010_disputes_admin.sql.' },
      { status: 503 }
    )
  }
  // BookingActionError (from lockBooking), unique / exclusion violations, 500s.
  return bookingErrorResponse(err, tag)
}

// ---------- Tab predicates (single source of truth: list AND counts use these) ----------
// They only touch columns of `d` (+ now()), so they also work in `FROM disputes d` count queries.

export const ACTIVE_SQL = `d.status::text IN ('OPEN','WORKER_RESPONDED','UNDER_REVIEW')`
export const RESPONSE_DUE_SQL = `(d.created_at + interval '${RESPONSE_WINDOW_HOURS} hours')`

const AWAITING_SQL = `(d.status::text = 'OPEN' AND d.worker_response IS NULL AND now() < ${RESPONSE_DUE_SQL})`

export const TAB_SQL: Record<DisputeTab, string> = {
  // needs an admin decision now
  open: `${ACTIVE_SQL} AND NOT d.is_escalated AND NOT ${AWAITING_SQL}`,
  // worker still has time to respond
  awaiting: `${AWAITING_SQL} AND NOT d.is_escalated`,
  // flagged for Super Admin
  escalated: `${ACTIVE_SQL} AND d.is_escalated`,
  resolved: `d.status::text IN ('RESOLVED','CLOSED')
             AND COALESCE(d.resolved_at, d.updated_at) >= now() - interval '${RESOLVED_WINDOW_DAYS} days'`,
}

// Active tabs: oldest first (longest waiting on top). Resolved: newest first.
export const TAB_ORDER: Record<DisputeTab, string> = {
  open: 'd.created_at ASC, d.id',
  awaiting: 'd.created_at ASC, d.id',
  escalated: 'd.created_at ASC, d.id',
  resolved: 'd.resolved_at DESC NULLS LAST, d.id',
}

export function parseTab(value: string | null): DisputeTab {
  return (DISPUTE_TABS as readonly string[]).includes(value ?? '') ? (value as DisputeTab) : 'open'
}

// ---------- List SQL ----------

export const DISPUTE_FROM_SQL = `
  FROM disputes d
  JOIN bookings b             ON b.id  = d.booking_id
  LEFT JOIN users u           ON u.id  = d.raised_by
  LEFT JOIN workers w         ON w.id  = d.raised_against
  LEFT JOIN categories c      ON c.id  = b.category_id
  LEFT JOIN user_addresses ua ON ua.id = b.address_id
  LEFT JOIN admin_users aa    ON aa.id = d.assigned_to
`

export const DISPUTE_COLUMNS_SQL = `
  d.id, d.booking_id, d.status::text AS status, d.resolution::text AS resolution,
  d.reason, d.refund_amount, d.is_escalated, d.created_at, d.updated_at, d.resolved_at,
  d.assigned_to, aa.full_name AS assigned_name,
  (d.worker_response IS NOT NULL) AS has_worker_response,
  COALESCE(array_length(d.evidence_urls, 1), 0) AS evidence_count,
  (d.reason LIKE '${ADMIN_OPENED_PREFIX}%') AS opened_by_admin,
  b.estimated_total, b.currency, b.category_id, c.name AS category_name,
  ${CITY_SQL} AS city,
  u.id AS user_id, u.name AS user_name, u.phone AS user_phone,
  w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone
`

// ---------- Filters ----------

export function buildDisputeWhere(sp: URLSearchParams, adminId: string) {
  const tab = parseTab(sp.get('tab'))
  const where: string[] = [`(${TAB_SQL[tab]})`]
  const params: unknown[] = []
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  const search = (sp.get('search') || '').trim()
  const city = sp.get('city') || 'all'
  const categoryId = sp.get('categoryId') || 'all'
  const assigned = sp.get('assigned') || 'all'
  const resolution = (sp.get('resolution') || 'all').toUpperCase()
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')
  const min = Number(sp.get('amountMin'))
  const max = Number(sp.get('amountMax'))

  if (search) {
    const p = push(`%${search}%`)
    where.push(
      `(d.id::text ILIKE ${p} OR d.booking_id::text ILIKE ${p} OR u.name ILIKE ${p}
        OR u.phone ILIKE ${p} OR w.name ILIKE ${p} OR w.phone ILIKE ${p})`
    )
  }
  if (city !== 'all') where.push(`${CITY_SQL} = ${push(city)}`)
  if (categoryId !== 'all' && CATEGORY_RE.test(categoryId)) {
    where.push(`b.category_id = ${push(categoryId)}`)
  }
  if (assigned === 'me') where.push(`d.assigned_to = ${push(adminId)}`)
  if (assigned === 'unassigned') where.push('d.assigned_to IS NULL')

  if (tab === 'resolved' && (DISPUTE_RESOLUTIONS as readonly string[]).includes(resolution)) {
    where.push(`d.resolution::text = ${push(resolution)}`)
  }
  if (sp.get('amountMin') && Number.isFinite(min)) where.push(`b.estimated_total >= ${push(min)}`)
  if (sp.get('amountMax') && Number.isFinite(max)) where.push(`b.estimated_total <= ${push(max)}`)

  if (dateFrom && DATE_RE.test(dateFrom)) where.push(`d.created_at >= ${push(dateFrom)}::date`)
  if (dateTo && DATE_RE.test(dateTo)) where.push(`d.created_at < (${push(dateTo)}::date + 1)`)

  return { tab, whereSql: `WHERE ${where.join(' AND ')}`, params }
}

// ---------- Row mapping ----------

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDisputeRow(r: any): DisputeListItem {
  return {
    id: r.id,
    bookingId: r.booking_id,
    status: r.status,
    resolution: r.resolution,
    reason: r.reason,
    openedByAdmin: r.opened_by_admin,
    isEscalated: r.is_escalated,
    hasWorkerResponse: r.has_worker_response,
    evidenceCount: r.evidence_count,
    refundAmount: num(r.refund_amount),
    amount: Number(r.estimated_total ?? 0),
    currency: r.currency ?? 'PKR',
    categoryId: r.category_id,
    categoryName: r.category_name,
    city: r.city,
    userId: r.user_id,
    userName: r.user_name,
    userPhone: r.user_phone,
    workerId: r.worker_id,
    workerName: r.worker_name,
    workerPhone: r.worker_phone,
    assignedToId: r.assigned_to,
    assignedToName: r.assigned_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resolvedAt: r.resolved_at,
  }
}