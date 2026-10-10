// app/api/admin/disputes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  DISPUTE_COLUMNS_SQL,
  DISPUTE_FROM_SQL,
  TAB_ORDER,
  buildDisputeWhere,
  disputeErrorResponse,
  mapDisputeRow,
} from '@/lib/disputes-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('disputes:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const { tab, whereSql, params } = buildDisputeWhere(sp, guard.admin.adminId)

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  const offset = (page - 1) * pageSize

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(
        `SELECT ${DISPUTE_COLUMNS_SQL}
         ${DISPUTE_FROM_SQL}
         ${whereSql}
         ORDER BY ${TAB_ORDER[tab]}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(`SELECT count(*)::int AS total ${DISPUTE_FROM_SQL} ${whereSql}`, params),
    ])

    const total = countRes.rows[0]?.total ?? 0
    return NextResponse.json({
      data: listRes.rows.map(mapDisputeRow),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (err) {
    return disputeErrorResponse(err, '[GET /api/admin/disputes]')
  }
}