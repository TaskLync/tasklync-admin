// app/api/admin/payments/overview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  COMPLETED_AT_SQL,
  COMPLETED_SQL,
  METHOD_SQL,
  num,
  paymentsErrorResponse,
  periodStartSql,
} from '@/lib/payments-api'
import type { LedgerMethod, OverviewPeriod, PaymentOverview } from '@/types/payment'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('payments:view')
  if (!guard.ok) return guard.response

  const period: OverviewPeriod = req.nextUrl.searchParams.get('period') === 'ytd' ? 'ytd' : 'mtd'
  const start = periodStartSql(period)

  try {
    const [rev, pay, esc, ref, wal, att, spark, method] = await Promise.all([
      db.query(
        `SELECT COALESCE(sum(b.estimated_total), 0) AS gross,
                COALESCE(sum(b.platform_fee), 0)    AS fees,
                count(*)::int                       AS completed
         FROM bookings b
         WHERE ${COMPLETED_SQL} AND ${COMPLETED_AT_SQL} >= ${start}`
      ),
      db.query(
        `SELECT COALESCE(sum(amount) FILTER (
                  WHERE status::text = 'COMPLETED' AND completed_at >= ${start}), 0) AS paid,
                COALESCE(sum(amount) FILTER (
                  WHERE status::text IN ('PENDING','PROCESSING')), 0) AS in_flight
         FROM worker_payouts`
      ),
      db.query(
        `SELECT COALESCE(sum(booking_amount), 0) AS held, count(*)::int AS n
         FROM payments WHERE status::text = 'HELD'`
      ),
      db.query(
        `SELECT COALESCE(sum(amount) FILTER (
                  WHERE status::text = 'COMPLETED'
                    AND COALESCE(completed_at, created_at) >= ${start}), 0) AS issued,
                COALESCE(sum(amount) FILTER (
                  WHERE status::text IN ('PENDING','PROCESSING')), 0) AS pending
         FROM refunds`
      ),
      db.query(
        `SELECT COALESCE(sum(balance), 0) AS balance,
                COALESCE(sum(pending_balance), 0) AS pending
         FROM worker_wallets`
      ),
      db.query(
        `SELECT
           (SELECT count(*) FROM payments WHERE status::text = 'FAILED')::int       AS failed_payments,
           (SELECT count(*) FROM worker_payouts WHERE status::text = 'FAILED')::int AS failed_payouts,
           (SELECT count(*) FROM refunds WHERE status::text = 'FAILED')::int        AS failed_refunds,
           (SELECT count(*) FROM refunds
              WHERE status::text IN ('PENDING','PROCESSING')
                AND created_at < now() - interval '24 hours')::int                  AS stale_refunds,
           (SELECT count(*) FROM dead_letters
              WHERE topic IN ('payment-payouts','payment-refunds')
                AND created_at > now() - interval '7 days')::int                    AS dead_letters`
      ),
      db.query(
        `SELECT d::date AS day,
                COALESCE(sum(b.estimated_total), 0) AS gross,
                COALESCE(sum(b.platform_fee), 0)    AS fees
         FROM generate_series(
                (now() AT TIME ZONE 'Asia/Karachi')::date - 6,
                (now() AT TIME ZONE 'Asia/Karachi')::date, '1 day') d
         LEFT JOIN bookings b
           ON ${COMPLETED_SQL}
          AND (${COMPLETED_AT_SQL} AT TIME ZONE 'Asia/Karachi')::date = d::date
         GROUP BY d ORDER BY d`
      ),
      db.query(
        `SELECT ${METHOD_SQL} AS method, count(*)::int AS bookings,
                COALESCE(sum(b.estimated_total), 0) AS gross
         FROM bookings b
         LEFT JOIN payments p ON p.booking_id = b.id
         WHERE ${COMPLETED_SQL} AND ${COMPLETED_AT_SQL} >= ${start}
         GROUP BY 1 ORDER BY gross DESC`
      ),
    ])

    const a = att.rows[0]
    const overview: PaymentOverview = {
      period,
      currency: 'PKR',
      grossRevenue: num(rev.rows[0].gross),
      platformFees: num(rev.rows[0].fees),
      completedBookings: rev.rows[0].completed,
      workerPayoutsPaid: num(pay.rows[0].paid),
      payoutsInFlight: num(pay.rows[0].in_flight),
      escrowHeld: num(esc.rows[0].held),
      escrowCount: esc.rows[0].n,
      refundsIssued: num(ref.rows[0].issued),
      refundsPending: num(ref.rows[0].pending),
      walletBalance: num(wal.rows[0].balance),
      walletPending: num(wal.rows[0].pending),
      grossSparkline7d: spark.rows.map((r) => num(r.gross)),
      feesSparkline7d: spark.rows.map((r) => num(r.fees)),
      byMethod: method.rows.map((r) => ({
        method: r.method as LedgerMethod,
        bookings: r.bookings,
        gross: num(r.gross),
      })),
      attention: {
        failedPayments: a.failed_payments,
        failedPayouts: a.failed_payouts,
        failedRefunds: a.failed_refunds,
        stalePendingRefunds: a.stale_refunds,
        deadLetters7d: a.dead_letters,
      },
    }
    return NextResponse.json(overview)
  } catch (err) {
    return paymentsErrorResponse(err, '[GET /api/admin/payments/overview]')
  }
}