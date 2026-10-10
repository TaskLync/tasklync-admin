// app/api/admin/payments/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { REPORT_TYPES, type ReportType } from '@/lib/payment-constants'
import {
  CITY_SQL,
  COMPLETED_AT_SQL,
  COMPLETED_SQL,
  TXN_COLUMNS_SQL,
  TXN_FROM_SQL,
  buildTransactionWhere,
  csvResponse,
  dateRange,
  mapTransactionRow,
  num,
  paymentsErrorResponse,
} from '@/lib/payments-api'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 20_000

export async function GET(req: NextRequest) {
  const guard = await requirePermission('payments:export')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const type = (sp.get('type') ?? '') as ReportType
  if (!(REPORT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  }

  const { from, to } = dateRange(sp)
  const done = `${COMPLETED_AT_SQL} >= $1::date AND ${COMPLETED_AT_SQL} < ($2::date + 1)`

  try {
    let filename = type as string
    let header: string[] = []
    let rows: unknown[][] = []

    if (type === 'monthly-revenue' || type === 'tax-summary') {
      const res = await db.query(
        `SELECT to_char(date_trunc('month', ${COMPLETED_AT_SQL} AT TIME ZONE 'Asia/Karachi'), 'YYYY-MM') AS month,
                count(*)::int AS bookings,
                COALESCE(sum(b.estimated_total), 0) AS gross,
                COALESCE(sum(b.platform_fee), 0)    AS fees,
                COALESCE(sum(b.worker_amount), 0)   AS worker
         FROM bookings b
         WHERE ${COMPLETED_SQL} AND ${done}
         GROUP BY 1 ORDER BY 1`,
        [from, to]
      )
      if (type === 'monthly-revenue') {
        filename = 'monthly-revenue'
        header = ['Month', 'Completed bookings', 'Gross (PKR)', 'Platform fees (PKR)', 'Worker amount (PKR)']
        rows = res.rows.map((r) => [r.month, r.bookings, num(r.gross).toFixed(2), num(r.fees).toFixed(2), num(r.worker).toFixed(2)])
      } else {
        filename = 'platform-fees-tax-summary'
        header = ['Month', 'Completed bookings', 'Gross booking value (PKR)', 'Platform fees collected (PKR)']
        rows = res.rows.map((r) => [r.month, r.bookings, num(r.gross).toFixed(2), num(r.fees).toFixed(2)])
      }
    } else if (type === 'city-value') {
      const res = await db.query(
        `SELECT COALESCE(${CITY_SQL}, 'Other') AS city, count(*)::int AS bookings,
                COALESCE(sum(b.estimated_total), 0) AS gross,
                COALESCE(sum(b.platform_fee), 0)    AS fees
         FROM bookings b
         LEFT JOIN workers w         ON w.id = b.worker_id
         LEFT JOIN user_addresses ua ON ua.id = b.address_id
         WHERE ${COMPLETED_SQL} AND ${done}
         GROUP BY 1 ORDER BY gross DESC`,
        [from, to]
      )
      filename = 'booking-value-by-city'
      header = ['City', 'Completed bookings', 'Gross (PKR)', 'Platform fees (PKR)']
      rows = res.rows.map((r) => [r.city, r.bookings, num(r.gross).toFixed(2), num(r.fees).toFixed(2)])
    } else if (type === 'payouts') {
      // Destinations are intentionally NOT exported (phone numbers / IBANs).
      const res = await db.query(
        `SELECT po.initiated_at, po.completed_at, w.name AS worker_name, w.phone AS worker_phone,
                p.booking_id, po.amount, po.currency, po.payout_method::text AS method,
                po.status::text AS status, po.gateway_reference, po.failure_reason
         FROM worker_payouts po
         LEFT JOIN workers w  ON w.id = po.worker_id
         LEFT JOIN payments p ON p.id = po.payment_id
         WHERE po.initiated_at >= $1::date AND po.initiated_at < ($2::date + 1)
         ORDER BY po.initiated_at
         LIMIT ${MAX_ROWS}`,
        [from, to]
      )
      filename = 'worker-payouts'
      header = ['Initiated', 'Completed', 'Worker', 'Worker phone', 'Booking ID', 'Amount', 'Currency', 'Method', 'Status', 'Gateway reference', 'Failure reason']
      rows = res.rows.map((r) => [
        new Date(r.initiated_at).toISOString(),
        r.completed_at ? new Date(r.completed_at).toISOString() : '',
        r.worker_name, r.worker_phone, r.booking_id, num(r.amount).toFixed(2), r.currency,
        r.method, r.status, r.gateway_reference, r.failure_reason,
      ])
    } else {
      // transactions: same filters as the ledger tab
      const { whereSql, params } = buildTransactionWhere(sp)
      const res = await db.query(
        `SELECT ${TXN_COLUMNS_SQL} ${TXN_FROM_SQL} ${whereSql}
         ORDER BY txn_at DESC, b.id LIMIT ${MAX_ROWS}`,
        params
      )
      filename = 'transactions'
      header = ['Date', 'Booking ID', 'Customer', 'Customer phone', 'Worker', 'City', 'Gross', 'Platform fee', 'Worker amount', 'Refunded', 'Currency', 'Method', 'Status', 'Gateway transaction ID', 'Gateway order ID']
      rows = res.rows.map(mapTransactionRow).map((t) => [
        new Date(t.txnAt).toISOString(), t.bookingId, t.userName, t.userPhone, t.workerName, t.city,
        t.gross.toFixed(2), t.platformFee.toFixed(2), t.workerAmount.toFixed(2), t.refunded.toFixed(2),
        t.currency, t.method, t.status, t.gatewayTransactionId, t.gatewayOrderId,
      ])
    }

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'payments.report_exported',
      resourceType: 'payments',
      notes: `${type}: ${rows.length} rows (${from} to ${to})`,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return csvResponse(filename, header, rows)
  } catch (err) {
    return paymentsErrorResponse(err, '[GET /api/admin/payments/reports]')
  }
}