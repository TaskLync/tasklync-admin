// app/api/admin/payments/payouts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  PAYOUT_COLUMNS_SQL,
  PAYOUT_FROM_SQL,
  buildPayoutWhere,
  mapPayoutRow,
  pagedResponse,
  parsePaging,
  paymentsErrorResponse,
} from '@/lib/payments-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('payments:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const { whereSql, params } = buildPayoutWhere(sp)
  const { page, pageSize, offset } = parsePaging(sp)

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(
        `SELECT ${PAYOUT_COLUMNS_SQL}
         ${PAYOUT_FROM_SQL}
         ${whereSql}
         ORDER BY po.initiated_at DESC, po.id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(`SELECT count(*)::int AS total ${PAYOUT_FROM_SQL} ${whereSql}`, params),
    ])
    return NextResponse.json(
      pagedResponse(listRes.rows.map(mapPayoutRow), countRes.rows[0].total, page, pageSize)
    )
  } catch (err) {
    return paymentsErrorResponse(err, '[GET /api/admin/payments/payouts]')
  }
}