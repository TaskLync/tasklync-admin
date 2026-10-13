// app/api/admin/reviews/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  REVIEW_COLUMNS_SQL,
  REVIEW_FROM_SQL,
  TAB_ORDER,
  buildReviewWhere,
  mapReviewRow,
  reviewErrorResponse,
} from '@/lib/reviews-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('reviews:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const { tab, whereSql, params } = buildReviewWhere(sp)

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  const offset = (page - 1) * pageSize

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(
        `SELECT ${REVIEW_COLUMNS_SQL}
         ${REVIEW_FROM_SQL}
         ${whereSql}
         ORDER BY ${TAB_ORDER[tab]}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, offset]
      ),
      db.query(`SELECT count(*)::int AS total ${REVIEW_FROM_SQL} ${whereSql}`, params),
    ])

    const total = countRes.rows[0]?.total ?? 0
    return NextResponse.json({
      data: listRes.rows.map(mapReviewRow),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (err) {
    return reviewErrorResponse(err, '[GET /api/admin/reviews]')
  }
}