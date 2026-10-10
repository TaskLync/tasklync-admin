// app/api/admin/disputes/refunds/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  REFUND_COLUMNS_SQL,
  REFUND_FROM_SQL,
  buildRefundWhere,
  mapRefundRow,
  pagedResponse,
  parsePaging,
  paymentsErrorResponse,
} from '@/lib/payments-api'

export const dynamic = 'force-dynamic'

const DISPUTE_ONLY_SQL = 'EXISTS (SELECT 1 FROM disputes dd WHERE dd.booking_id = r.booking_id)'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('disputes:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const base = buildRefundWhere(sp)
  const { page, pageSize, offset } = parsePaging(sp)

  // 'everything' lifts the dispute-only restriction.
  const disputeOnly = sp.get('source') !== 'everything'
  const whereSql = disputeOnly
    ? base.whereSql
      ? `${base.whereSql} AND ${DISPUTE_ONLY_SQL}`
      : `WHERE ${DISPUTE_ONLY_SQL}`
    : base.whereSql
  const params = base.params

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(
        `SELECT ${REFUND_COLUMNS_SQL}
         ${REFUND_FROM_SQL}
         ${whereSql}
         ORDER BY r.initiated_at DESC, r.id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(`SELECT count(*)::int AS total ${REFUND_FROM_SQL} ${whereSql}`, params),
    ])
    return NextResponse.json(
      pagedResponse(listRes.rows.map(mapRefundRow), countRes.rows[0].total, page, pageSize)
    )
  } catch (err) {
    return paymentsErrorResponse(err, '[GET /api/admin/disputes/refunds]')
  }
}