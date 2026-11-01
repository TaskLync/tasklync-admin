// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

const BOOKING_BUCKETS: Record<string, string> = {
  '0': 'u.total_bookings = 0',
  '1-5': 'u.total_bookings BETWEEN 1 AND 5',
  '5-20': 'u.total_bookings BETWEEN 6 AND 20',
  '20+': 'u.total_bookings > 20',
}

const SORT_COLUMNS: Record<string, string> = {
  created_at: 'u.created_at',
  name: 'u.name',
  total_bookings: 'u.total_bookings',
}

const HAS_DISPUTE_SQL = 'EXISTS (SELECT 1 FROM disputes d WHERE d.raised_by = u.id)'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('users:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const search = (sp.get('search') || '').trim()
  const city = sp.get('city') || 'all'
  const status = sp.get('status') || 'all'
  const bookingsBucket = sp.get('bookingsBucket') || 'all'
  const hasDispute = sp.get('hasDispute') || 'all'
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')
  const sortBy = SORT_COLUMNS[sp.get('sortBy') || 'created_at'] || 'u.created_at'
  const sortDir = sp.get('sortDir') === 'asc' ? 'ASC' : 'DESC'
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10)))
  const offset = (page - 1) * pageSize

  const where: string[] = []

  const params: any[] = []
  let i = 1

  if (search) {
    params.push(`%${search}%`)
    where.push(`(u.name ILIKE $${i} OR u.phone ILIKE $${i} OR u.email ILIKE $${i})`)
    i++
  }

  if (city !== 'all') {
    params.push(city)
    where.push(`EXISTS (
      SELECT 1 FROM user_addresses a
      WHERE a.user_id = u.id AND a.is_default = true AND a.city = $${i}
    )`)
    i++
  }

  if (status !== 'all') {
    params.push(status)
    where.push(`fn_user_status(u.is_active, u.deleted_at, u.banned_at, u.suspended_until) = $${i}`)
    i++
  }

  if (bookingsBucket !== 'all' && BOOKING_BUCKETS[bookingsBucket]) {
    where.push(BOOKING_BUCKETS[bookingsBucket])
  }

  if (hasDispute === 'yes') {
    where.push(HAS_DISPUTE_SQL)
  } else if (hasDispute === 'no') {
    where.push(`NOT ${HAS_DISPUTE_SQL}`)
  }

  if (dateFrom) {
    params.push(dateFrom)
    where.push(`u.created_at >= $${i}`)
    i++
  }
  if (dateTo) {
    params.push(dateTo)
    where.push(`u.created_at < ($${i}::date + 1)`)
    i++
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const listSql = `
    SELECT
      u.id, u.name, u.phone, u.email, u.avatar_url,
      u.total_bookings, u.is_active, u.created_at,
      fn_user_status(u.is_active, u.deleted_at, u.banned_at, u.suspended_until) AS status,
      ${HAS_DISPUTE_SQL} AS has_dispute,
      (SELECT a.city FROM user_addresses a WHERE a.user_id = u.id AND a.is_default = true LIMIT 1) AS city
    FROM users u
    ${whereSql}
    ORDER BY ${sortBy} ${sortDir}
    LIMIT $${i} OFFSET $${i + 1}
  `
  const countSql = `SELECT count(*)::int AS total FROM users u ${whereSql}`

  const listParams = [...params, pageSize, offset]

  try {
    const [listRes, countRes] = await Promise.all([
      db.query(listSql, listParams),
      db.query(countSql, params),
    ])

    const data = listRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      avatarUrl: r.avatar_url,
      city: r.city,
      totalBookings: r.total_bookings,
      isActive: r.is_active,
      status: r.status,
      hasDispute: r.has_dispute,
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
    console.error('[GET /api/admin/users]', err)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}