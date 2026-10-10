// app/api/admin/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  FROM_SQL,
  LIST_COLUMNS_SQL,
  SORT_COLUMNS,
  buildBookingWhere,
  mapBookingRow,
  toWhereSql,
} from '@/lib/bookings-api'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('bookings:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const { where, params } = buildBookingWhere(sp)
  const whereSql = toWhereSql(where)

  const sortBy = SORT_COLUMNS[sp.get('sortBy') || 'created_at'] || 'b.created_at'
  const sortDir = sp.get('sortDir') === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  const offset = (page - 1) * pageSize

  const listSql = `
    SELECT ${LIST_COLUMNS_SQL}
    ${FROM_SQL}
    ${whereSql}
    ORDER BY ${sortBy} ${sortDir}, b.id
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  const countSql = `SELECT count(*)::int AS total ${FROM_SQL} ${whereSql}`

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(listSql, [...params, pageSize, offset]),
      db.query(countSql, params),
    ])

    const total = countRes.rows[0]?.total ?? 0
    return NextResponse.json({
      data: listRes.rows.map(mapBookingRow),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (err) {
    console.error('[GET /api/admin/bookings]', err)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
}