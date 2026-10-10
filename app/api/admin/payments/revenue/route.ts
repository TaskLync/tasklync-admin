// app/api/admin/payments/revenue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  CITY_SQL,
  COMPLETED_AT_SQL,
  COMPLETED_SQL,
  num,
  paymentsErrorResponse,
} from '@/lib/payments-api'
import type { RevenueSeries } from '@/types/payment'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('payments:view')
  if (!guard.ok) return guard.response

  const days = req.nextUrl.searchParams.get('days') === '90' ? 90 : 30

  try {
    const [chart, byCity] = await Promise.all([
      db.query(
        `SELECT d::date AS day,
                COALESCE(sum(b.estimated_total), 0) AS gross,
                COALESCE(sum(b.platform_fee), 0)    AS fees,
                COALESCE(sum(b.worker_amount), 0)   AS worker
         FROM generate_series(
                (now() AT TIME ZONE 'Asia/Karachi')::date - ($1::int - 1),
                (now() AT TIME ZONE 'Asia/Karachi')::date, '1 day') d
         LEFT JOIN bookings b
           ON ${COMPLETED_SQL}
          AND (${COMPLETED_AT_SQL} AT TIME ZONE 'Asia/Karachi')::date = d::date
         GROUP BY d ORDER BY d`,
        [days]
      ),
      db.query(
        `SELECT COALESCE(${CITY_SQL}, 'Other') AS city, count(*)::int AS bookings,
                COALESCE(sum(b.estimated_total), 0) AS gross,
                COALESCE(sum(b.platform_fee), 0)    AS fees
         FROM bookings b
         LEFT JOIN workers w         ON w.id = b.worker_id
         LEFT JOIN user_addresses ua ON ua.id = b.address_id
         WHERE ${COMPLETED_SQL}
           AND ${COMPLETED_AT_SQL} >= (now() AT TIME ZONE 'Asia/Karachi')::date - ($1::int - 1)
         GROUP BY 1 ORDER BY gross DESC`,
        [days]
      ),
    ])

    const body: RevenueSeries = {
      days,
      chart: chart.rows.map((r) => ({
        date: r.day,
        gross: num(r.gross),
        fees: num(r.fees),
        workerAmount: num(r.worker),
      })),
      byCity: byCity.rows.map((r) => ({
        city: r.city,
        bookings: r.bookings,
        gross: num(r.gross),
        fees: num(r.fees),
      })),
    }
    return NextResponse.json(body)
  } catch (err) {
    return paymentsErrorResponse(err, '[GET /api/admin/payments/revenue]')
  }
}