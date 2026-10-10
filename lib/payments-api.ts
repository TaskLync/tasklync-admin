// lib/payments-api.ts
// Server-only helpers for the /api/admin/payments/* routes.
import { NextResponse } from 'next/server'
import { CITY_SQL } from '@/lib/bookings-api'
import { PaymentServiceError } from '@/lib/payment-service'
import {
  LEDGER_METHODS,
  LEDGER_STATUSES,
  PAYOUT_STATUSES,
  REFUND_REASONS,
  REFUND_STATUSES,
  REFUNDABLE_STATUSES,
  type LedgerMethod,
  type LedgerStatus,
} from '@/lib/payment-constants'
import type { PayoutRow, RefundRow, TransactionRow } from '@/types/payment'

export { CITY_SQL }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ---------- Errors ----------

export class PaymentActionError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function paymentsErrorResponse(err: unknown, tag: string) {
  if (err instanceof PaymentActionError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  if (err instanceof PaymentServiceError) {
    const status = err.status >= 500 ? 502 : err.status
    return NextResponse.json({ error: err.message, code: err.code }, { status })
  }
  const code = (err as { code?: string } | null)?.code
  if (code === '42P01' || code === '42703') {
    console.error(tag, err)
    return NextResponse.json(
      {
        error:
          'Payment tables are missing or out of date. Run the payment-service migrations on the shared database.',
      },
      { status: 503 }
    )
  }
  console.error(tag, err)
  return NextResponse.json({ error: 'Request failed' }, { status: 500 })
}

// ---------- Small utilities ----------

export const num = (v: unknown) => Number(v ?? 0)

/** Never send raw phone numbers / IBANs to the browser. */
export function maskDestination(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length <= 4 ? value : `•••• ${value.slice(-4)}`
}

export function parsePaging(sp: URLSearchParams) {
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '25', 10) || 25))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function pagedResponse<T>(data: T[], total: number, page: number, pageSize: number) {
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

/** from/to default to the last 365 days. */
export function dateRange(sp: URLSearchParams): { from: string; to: string } {
  const now = new Date()
  const yearAgo = new Date(now.getTime() - 365 * 86_400_000)
  const f = sp.get('dateFrom')
  const t = sp.get('dateTo')
  return {
    from: f && DATE_RE.test(f) ? f : yearAgo.toISOString().slice(0, 10),
    to: t && DATE_RE.test(t) ? t : now.toISOString().slice(0, 10),
  }
}

function whereBuilder() {
  const where: string[] = []
  const params: unknown[] = []
  const push = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }
  return { where, params, push }
}
const toWhereSql = (where: string[]) => (where.length ? `WHERE ${where.join(' AND ')}` : '')

// ---------- CSV ----------

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val)
  // Neutralise spreadsheet formula injection in text cells (names, notes).
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function csvResponse(filename: string, header: string[], rows: unknown[][]) {
  const lines = [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))]
  // BOM so Excel opens UTF-8 names correctly
  return new NextResponse('\uFEFF' + lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  })
}

// ---------- SQL fragments ----------
// Defined once so list, totals and export can never disagree.

export const COMPLETED_SQL = `b.status::text IN ('COMPLETED','AUTO_COMPLETED')`
export const COMPLETED_AT_SQL = `COALESCE(b.completed_at, b.updated_at)`

/** Start of the current month / year in Asia/Karachi (same convention as the workers + bookings KPIs). */
export function periodStartSql(period: 'mtd' | 'ytd') {
  const unit = period === 'ytd' ? 'year' : 'month'
  return `(date_trunc('${unit}', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')`
}

export const GROSS_SQL = `COALESCE(p.booking_amount, b.estimated_total)`
export const FEE_SQL = `COALESCE(p.platform_fee, b.platform_fee)`
export const WORKER_SQL = `COALESCE(p.worker_amount, b.worker_amount)`
export const METHOD_SQL = `COALESCE(p.method::text, 'COD')`
export const LEDGER_STATUS_SQL = `COALESCE(p.status::text, 'COD_COLLECTED')`
export const TXN_DATE_SQL = `COALESCE(p.paid_at, p.created_at, b.completed_at, b.updated_at)`

export const TXN_FROM_SQL = `
  FROM bookings b
  LEFT JOIN payments p        ON p.booking_id = b.id
  LEFT JOIN users u           ON u.id = b.user_id
  LEFT JOIN workers w         ON w.id = b.worker_id
  LEFT JOIN user_addresses ua ON ua.id = b.address_id
`

export const TXN_COLUMNS_SQL = `
  b.id AS booking_id, p.id AS payment_id,
  u.id AS user_id, u.name AS user_name, u.phone AS user_phone,
  w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone,
  ${CITY_SQL} AS city,
  ${GROSS_SQL} AS gross, ${FEE_SQL} AS platform_fee, ${WORKER_SQL} AS worker_amount,
  COALESCE(p.currency, b.currency) AS currency,
  ${METHOD_SQL} AS method, ${LEDGER_STATUS_SQL} AS status,
  p.gateway_transaction_id, p.gateway_order_id, p.failure_reason,
  (SELECT COALESCE(sum(r.amount), 0) FROM refunds r
     WHERE r.payment_id = p.id AND r.status::text <> 'FAILED') AS refunded,
  ${TXN_DATE_SQL} AS txn_at
`

// ---------- Transactions ----------

export function buildTransactionWhere(sp: URLSearchParams) {
  const { where, params, push } = whereBuilder()

  // Every online payment, plus COD bookings that were actually completed.
  where.push(`(p.id IS NOT NULL OR ${COMPLETED_SQL})`)

  const search = (sp.get('search') || '').trim()
  const status = (sp.get('status') || 'all').toUpperCase()
  const method = (sp.get('method') || 'all').toUpperCase()
  const city = sp.get('city') || 'all'
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')

  if (search) {
    const p = push(`%${search}%`)
    where.push(
      `(b.id::text ILIKE ${p} OR u.name ILIKE ${p} OR u.phone ILIKE ${p} OR w.name ILIKE ${p}
        OR w.phone ILIKE ${p} OR p.gateway_transaction_id ILIKE ${p} OR p.gateway_order_id ILIKE ${p})`
    )
  }
  if ((LEDGER_STATUSES as readonly string[]).includes(status)) {
    where.push(`${LEDGER_STATUS_SQL} = ${push(status)}`)
  }
  if ((LEDGER_METHODS as readonly string[]).includes(method)) {
    where.push(`${METHOD_SQL} = ${push(method)}`)
  }
  if (city !== 'all') where.push(`${CITY_SQL} = ${push(city)}`)

  const min = Number(sp.get('amountMin'))
  const max = Number(sp.get('amountMax'))
  if (sp.get('amountMin') && Number.isFinite(min)) where.push(`${GROSS_SQL} >= ${push(min)}`)
  if (sp.get('amountMax') && Number.isFinite(max)) where.push(`${GROSS_SQL} <= ${push(max)}`)

  if (dateFrom && DATE_RE.test(dateFrom)) where.push(`${TXN_DATE_SQL} >= ${push(dateFrom)}::date`)
  if (dateTo && DATE_RE.test(dateTo)) where.push(`${TXN_DATE_SQL} < (${push(dateTo)}::date + 1)`)

  return { whereSql: toWhereSql(where), params }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTransactionRow(r: any): TransactionRow {
  const gross = num(r.gross)
  const refunded = num(r.refunded)
  const status = r.status as LedgerStatus
  const refundable =
    r.payment_id && REFUNDABLE_STATUSES.includes(status)
      ? Math.max(0, Math.round((gross - refunded) * 100) / 100)
      : 0

  return {
    bookingId: r.booking_id,
    paymentId: r.payment_id,
    userId: r.user_id,
    userName: r.user_name,
    userPhone: r.user_phone,
    workerId: r.worker_id,
    workerName: r.worker_name,
    workerPhone: r.worker_phone,
    city: r.city,
    gross,
    platformFee: num(r.platform_fee),
    workerAmount: num(r.worker_amount),
    currency: r.currency ?? 'PKR',
    method: r.method as LedgerMethod,
    status,
    gatewayTransactionId: r.gateway_transaction_id,
    gatewayOrderId: r.gateway_order_id,
    failureReason: r.failure_reason,
    refunded,
    refundable,
    txnAt: r.txn_at,
  }
}

// ---------- Payouts ----------

export const PAYOUT_FROM_SQL = `
  FROM worker_payouts po
  LEFT JOIN workers w  ON w.id = po.worker_id
  LEFT JOIN payments p ON p.id = po.payment_id
`

export const PAYOUT_COLUMNS_SQL = `
  po.id, po.worker_id, w.name AS worker_name, w.phone AS worker_phone,
  po.payment_id, p.booking_id, po.amount, po.currency,
  po.payout_method::text AS method, po.payout_destination,
  po.status::text AS status, po.gateway_reference, po.failure_reason,
  po.initiated_at, po.completed_at
`

export function buildPayoutWhere(sp: URLSearchParams) {
  const { where, params, push } = whereBuilder()
  const search = (sp.get('search') || '').trim()
  const status = (sp.get('status') || 'all').toUpperCase()
  const method = (sp.get('method') || 'all').toUpperCase()
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')

  if (search) {
    const p = push(`%${search}%`)
    where.push(
      `(po.id::text ILIKE ${p} OR p.booking_id::text ILIKE ${p} OR w.name ILIKE ${p}
        OR w.phone ILIKE ${p} OR po.gateway_reference ILIKE ${p})`
    )
  }
  if ((PAYOUT_STATUSES as readonly string[]).includes(status)) {
    where.push(`po.status::text = ${push(status)}`)
  }
  if (/^[A-Z_]{2,30}$/.test(method)) where.push(`po.payout_method::text = ${push(method)}`)
  if (dateFrom && DATE_RE.test(dateFrom)) where.push(`po.initiated_at >= ${push(dateFrom)}::date`)
  if (dateTo && DATE_RE.test(dateTo)) where.push(`po.initiated_at < (${push(dateTo)}::date + 1)`)

  return { whereSql: toWhereSql(where), params }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPayoutRow(r: any): PayoutRow {
  return {
    id: r.id,
    workerId: r.worker_id,
    workerName: r.worker_name,
    workerPhone: r.worker_phone,
    paymentId: r.payment_id,
    bookingId: r.booking_id,
    amount: num(r.amount),
    currency: r.currency ?? 'PKR',
    method: r.method,
    destination: maskDestination(r.payout_destination),
    status: r.status,
    gatewayReference: r.gateway_reference,
    failureReason: r.failure_reason,
    initiatedAt: r.initiated_at,
    completedAt: r.completed_at,
  }
}

// ---------- Refunds ----------

export const REFUND_FROM_SQL = `
  FROM refunds r
  LEFT JOIN users u        ON u.id = r.user_id
  LEFT JOIN admin_users au ON au.id = r.initiated_by
`

export const REFUND_COLUMNS_SQL = `
  r.id, r.payment_id, r.booking_id, r.user_id, u.name AS user_name, u.phone AS user_phone,
  r.amount, r.refund_percentage, r.reason::text AS reason, r.status::text AS status,
  r.refund_method::text AS method, r.refund_destination,
  r.gateway_reference, r.failure_reason,
  (CASE WHEN r.initiated_by IS NOT NULL THEN 'admin' ELSE 'system' END) AS initiated_by_kind,
  au.full_name AS admin_name, r.initiated_at, r.completed_at
`

export function buildRefundWhere(sp: URLSearchParams) {
  const { where, params, push } = whereBuilder()
  const search = (sp.get('search') || '').trim()
  const status = (sp.get('status') || 'all').toUpperCase()
  const reason = (sp.get('reason') || 'all').toUpperCase()
  const initiatedBy = sp.get('initiatedBy') || 'all'
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')

  if (search) {
    const p = push(`%${search}%`)
    where.push(
      `(r.id::text ILIKE ${p} OR r.booking_id::text ILIKE ${p} OR u.name ILIKE ${p}
        OR u.phone ILIKE ${p} OR r.gateway_reference ILIKE ${p})`
    )
  }
  if ((REFUND_STATUSES as readonly string[]).includes(status)) {
    where.push(`r.status::text = ${push(status)}`)
  }
  if ((REFUND_REASONS as readonly string[]).includes(reason)) {
    where.push(`r.reason::text = ${push(reason)}`)
  }
  if (initiatedBy === 'admin') where.push('r.initiated_by IS NOT NULL')
  if (initiatedBy === 'system') where.push('r.initiated_by IS NULL')
  if (dateFrom && DATE_RE.test(dateFrom)) where.push(`r.initiated_at >= ${push(dateFrom)}::date`)
  if (dateTo && DATE_RE.test(dateTo)) where.push(`r.initiated_at < (${push(dateTo)}::date + 1)`)

  return { whereSql: toWhereSql(where), params }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRefundRow(r: any): RefundRow {
  return {
    id: r.id,
    paymentId: r.payment_id,
    bookingId: r.booking_id,
    userId: r.user_id,
    userName: r.user_name,
    userPhone: r.user_phone,
    amount: num(r.amount),
    percentage: num(r.refund_percentage),
    reason: r.reason,
    status: r.status,
    method: r.method,
    destination: maskDestination(r.refund_destination),
    gatewayReference: r.gateway_reference,
    failureReason: r.failure_reason,
    initiatedBy: r.initiated_by_kind,
    adminName: r.admin_name,
    initiatedAt: r.initiated_at,
    completedAt: r.completed_at,
  }
}