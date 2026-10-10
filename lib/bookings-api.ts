// lib/bookings-api.ts
// Server-only helpers for the /api/admin/bookings/* routes.
import { NextResponse } from 'next/server'
import type { PoolClient } from 'pg'
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type BookingStatus,
} from '@/lib/booking-constants'
import type { BookingListItem } from '@/types/booking'

// Same transaction helper the verification actions use.
export { withTx } from '@/lib/verification-api'

// ---------- Errors ----------

export class BookingActionError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const bookingNotFound = () =>
  NextResponse.json({ error: 'Booking not found' }, { status: 404 })

export function bookingErrorResponse(err: unknown, tag: string) {
  if (err instanceof BookingActionError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const code = (err as { code?: string } | null)?.code
  if (code === '23505') {
    return NextResponse.json(
      { error: 'A conflicting record already exists (for example an open dispute).' },
      { status: 409 }
    )
  }
  if (code === '23P01') {
    return NextResponse.json(
      { error: 'That worker already has a booking that overlaps this time slot.' },
      { status: 409 }
    )
  }
  console.error(tag, err)
  return NextResponse.json({ error: 'Action failed' }, { status: 500 })
}

// ---------- SQL fragments (defined once so list, board and export never disagree) ----------

const CATEGORY_RE = /^[a-z0-9-]{1,50}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** bookings has no city column: use the job address city, fall back to the worker's city. */
export const CITY_SQL = 'COALESCE(ua.city, w.city)'

export const PAYMENT_STATUS_SQL = `(CASE
  WHEN COALESCE(b.refund_amount, 0) > 0 THEN 'refunded'
  WHEN b.is_payment_confirmed THEN 'paid'
  ELSE 'pending'
END)`

export const FROM_SQL = `
  FROM bookings b
  LEFT JOIN users u            ON u.id  = b.user_id
  LEFT JOIN workers w          ON w.id  = b.worker_id
  LEFT JOIN categories c       ON c.id  = b.category_id
  LEFT JOIN user_addresses ua  ON ua.id = b.address_id
`

export const LIST_COLUMNS_SQL = `
  b.id, b.status::text AS status, b.category_id, c.name AS category_name,
  b.estimated_total, b.currency, b.is_urgent, b.duration_hours,
  b.scheduled_at, b.created_at, b.updated_at, b.started_at,
  u.id AS user_id, u.name AS user_name, u.phone AS user_phone,
  w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone,
  ${CITY_SQL} AS city,
  ${PAYMENT_STATUS_SQL} AS payment_status,
  EXISTS (SELECT 1 FROM disputes d WHERE d.booking_id = b.id) AS has_dispute
`

export const BOARD_COLUMN_SQL = `(CASE b.status::text
  WHEN 'PENDING'             THEN 'pending'
  WHEN 'ACCEPTED'            THEN 'accepted'
  WHEN 'IN_PROGRESS'         THEN 'in_progress'
  WHEN 'COMPLETED_BY_WORKER' THEN 'completed_by_worker'
  WHEN 'COMPLETED'           THEN 'completed'
  WHEN 'AUTO_COMPLETED'      THEN 'completed'
  ELSE 'cancelled_disputed'
END)`

export const SORT_COLUMNS: Record<string, string> = {
  created_at: 'b.created_at',
  scheduled_at: 'b.scheduled_at',
  amount: 'b.estimated_total',
  updated_at: 'b.updated_at',
}

// ---------- Filters ----------

export function buildBookingWhere(
  sp: URLSearchParams,
  opts: { ignoreStatus?: boolean } = {}
): { where: string[]; params: unknown[] } {
  const where: string[] = []
  const params: unknown[] = []
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }

  const search = (sp.get('search') || '').trim()
  const status = sp.get('status') || 'all'
  const city = sp.get('city') || 'all'
  const categoryId = sp.get('categoryId') || 'all'
  const paymentStatus = sp.get('paymentStatus') || 'all'
  const hasDispute = sp.get('hasDispute') || 'all'
  const amountMin = Number(sp.get('amountMin'))
  const amountMax = Number(sp.get('amountMax'))
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')

  if (search) {
    const p = push(`%${search}%`)
    where.push(
      `(b.id::text ILIKE ${p} OR u.name ILIKE ${p} OR u.phone ILIKE ${p} OR w.name ILIKE ${p} OR w.phone ILIKE ${p})`
    )
  }

  if (!opts.ignoreStatus && (BOOKING_STATUSES as readonly string[]).includes(status)) {
    where.push(`b.status::text = ${push(status)}`)
  }

  if (city !== 'all') {
    where.push(`${CITY_SQL} = ${push(city)}`)
  }

  if (categoryId !== 'all' && CATEGORY_RE.test(categoryId)) {
    where.push(`b.category_id = ${push(categoryId)}`)
  }

  if ((PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) {
    where.push(`${PAYMENT_STATUS_SQL} = ${push(paymentStatus)}`)
  }

  if (hasDispute === 'yes') {
    where.push('EXISTS (SELECT 1 FROM disputes d WHERE d.booking_id = b.id)')
  } else if (hasDispute === 'no') {
    where.push('NOT EXISTS (SELECT 1 FROM disputes d WHERE d.booking_id = b.id)')
  }

  if (sp.get('amountMin') && Number.isFinite(amountMin)) {
    where.push(`b.estimated_total >= ${push(amountMin)}`)
  }
  if (sp.get('amountMax') && Number.isFinite(amountMax)) {
    where.push(`b.estimated_total <= ${push(amountMax)}`)
  }

  if (dateFrom && DATE_RE.test(dateFrom)) {
    where.push(`b.created_at >= ${push(dateFrom)}::date`)
  }
  if (dateTo && DATE_RE.test(dateTo)) {
    // inclusive of the whole "to" day
    where.push(`b.created_at < (${push(dateTo)}::date + 1)`)
  }

  return { where, params }
}

export const toWhereSql = (where: string[]) => (where.length ? `WHERE ${where.join(' AND ')}` : '')

// ---------- Row mapping ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBookingRow(r: any): BookingListItem {
  return {
    id: r.id,
    status: r.status,
    categoryId: r.category_id,
    categoryName: r.category_name,
    city: r.city,
    userId: r.user_id,
    userName: r.user_name,
    userPhone: r.user_phone,
    workerId: r.worker_id,
    workerName: r.worker_name,
    workerPhone: r.worker_phone,
    amount: Number(r.estimated_total ?? 0),
    currency: r.currency ?? 'PKR',
    isUrgent: r.is_urgent,
    durationHours: Number(r.duration_hours ?? 0),
    scheduledAt: r.scheduled_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    startedAt: r.started_at,
    paymentStatus: r.payment_status,
    hasDispute: r.has_dispute,
  }
}

// ---------- Action helpers (always call inside withTx) ----------

export interface LockedBooking {
  id: string
  userId: string
  workerId: string
  status: BookingStatus
  scheduledAt: Date
  estimatedTotal: number
  platformFee: number
  workerAmount: number
  currency: string
  isPaymentConfirmed: boolean
}

/** Tags this transaction so the status-history trigger records which admin did it. */
export async function setActor(client: PoolClient, adminEmail: string) {
  await client.query(`SELECT set_config('app.actor', $1, true)`, [`admin:${adminEmail}`])
}

/** Row-locks the booking so two admins (or booking-service) cannot race. */
export async function lockBooking(client: PoolClient, bookingId: string): Promise<LockedBooking> {
  const { rows } = await client.query(
    `SELECT id, user_id, worker_id, status::text AS status, scheduled_at,
            estimated_total, platform_fee, worker_amount, currency, is_payment_confirmed
     FROM bookings
     WHERE id = $1
     FOR UPDATE`,
    [bookingId]
  )
  if (rows.length === 0) throw new BookingActionError(404, 'Booking not found')
  const r = rows[0]
  return {
    id: r.id,
    userId: r.user_id,
    workerId: r.worker_id,
    status: r.status as BookingStatus,
    scheduledAt: r.scheduled_at,
    estimatedTotal: Number(r.estimated_total),
    platformFee: Number(r.platform_fee),
    workerAmount: Number(r.worker_amount),
    currency: r.currency,
    isPaymentConfirmed: r.is_payment_confirmed,
  }
}

/**
 * Queues a booking.events message in the SAME transaction (admin_event_outbox).
 * The envelope matches booking-service's so payment-service / chat-service
 * treat it exactly like one produced by booking-service.
 */
export async function enqueueBookingEvent(
  client: PoolClient,
  booking: Pick<LockedBooking, 'id' | 'userId' | 'workerId'>,
  params: {
    eventType: string
    status: BookingStatus
    adminEmail: string
    data?: Record<string, unknown>
  }
) {
  const payload = {
    event_type: params.eventType,
    booking_id: booking.id,
    user_id: booking.userId,
    worker_id: booking.workerId,
    status: params.status,
    timestamp: new Date().toISOString(),
    data: { ...(params.data ?? {}), triggered_by: 'admin', admin_email: params.adminEmail },
  }
  await client.query(
    `INSERT INTO admin_event_outbox (topic, event_type, event_key, payload)
     VALUES ('booking.events', $1, $2, $3)`,
    [params.eventType, booking.id, JSON.stringify(payload)]
  )
}

const NOTIFY_ENABLED = process.env.ADMIN_BOOKING_NOTIFICATIONS === 'true'

/** notification.send message. Off unless ADMIN_BOOKING_NOTIFICATIONS=true (templates must exist first). */
export async function enqueueNotification(
  client: PoolClient,
  params: {
    targetId: string | null
    targetType: 'user' | 'worker'
    templateKey: string
    data: Record<string, unknown>
    channels?: string[]
    priority?: 'high' | 'normal'
  }
) {
  if (!NOTIFY_ENABLED || !params.targetId) return
  const payload = {
    target_id: params.targetId,
    target_type: params.targetType,
    template_key: params.templateKey,
    template_data: params.data,
    channels: params.channels ?? ['push'],
    priority: params.priority ?? 'high',
  }
  await client.query(
    `INSERT INTO admin_event_outbox (topic, event_type, event_key, payload)
     VALUES ('notification.send', 'notification.send', $1, $2)`,
    [params.targetId, JSON.stringify(payload)]
  )
}