// app/api/admin/workers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  buildWorkerWhere,
  CATEGORY_NAMES_SQL,
  PRESENCE_SQL,
  SORT_COLUMNS,
  STATUS_SQL,
} from '@/lib/workers-api'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const { whereSql, params } = buildWorkerWhere(sp)

  const sortBy = SORT_COLUMNS[sp.get('sortBy') || 'created_at'] || 'w.created_at'
  const sortDir = sp.get('sortDir') === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  const offset = (page - 1) * pageSize

  const listSql = `
    SELECT
      w.id, w.name, w.phone, w.email, w.avatar_url, w.city,
      w.avg_rating, w.total_reviews, w.total_bookings,
      w.is_active, w.is_featured, w.created_at,
      lower(w.verification_status::text) AS verification_status,
      ${STATUS_SQL}   AS status,
      ${PRESENCE_SQL} AS presence,
      ${CATEGORY_NAMES_SQL} AS categories
    FROM workers w
    ${whereSql}
    ORDER BY ${sortBy} ${sortDir}, w.id
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  const countSql = `SELECT count(*)::int AS total FROM workers w ${whereSql}`

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(listSql, [...params, pageSize, offset]),
      db.query(countSql, params),
    ])

    const data = listRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      avatarUrl: r.avatar_url,
      city: r.city,
      categories: r.categories,
      avgRating: Number(r.avg_rating ?? 0),
      totalReviews: r.total_reviews ?? 0,
      totalBookings: r.total_bookings ?? 0,
      isActive: r.is_active,
      isFeatured: r.is_featured,
      verificationStatus: r.verification_status,
      status: r.status,
      presence: r.presence,
      createdAt: r.created_at,
    }))

    const total = countRes.rows[0]?.total ?? 0

    return NextResponse.json({
      data,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (err) {
    console.error('[GET /api/admin/workers]', err)
    return NextResponse.json({ error: 'Failed to load workers' }, { status: 500 })
  }
}