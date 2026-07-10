// app/api/admin/users/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

const BOOKING_BUCKETS: Record<string, string> = {
  '0': 'u.total_bookings = 0',
  '1-5': 'u.total_bookings BETWEEN 1 AND 5',
  '5-20': 'u.total_bookings BETWEEN 6 AND 20',
  '20+': 'u.total_bookings > 20',
}

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const guard = await requirePermission('users:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const search = (sp.get('search') || '').trim()
  const city = sp.get('city') || 'all'
  const status = sp.get('status') || 'all'
  const bookingsBucket = sp.get('bookingsBucket') || 'all'
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')

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
  if (dateFrom) {
    params.push(dateFrom)
    where.push(`u.created_at >= $${i}`)
    i++
  }
  if (dateTo) {
    params.push(dateTo)
    where.push(`u.created_at <= $${i}`)
    i++
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const sql = `
    SELECT
      u.name, u.phone, u.email,
      u.total_bookings, u.created_at,
      fn_user_status(u.is_active, u.deleted_at, u.banned_at, u.suspended_until) AS status,
      (SELECT a.city FROM user_addresses a WHERE a.user_id = u.id AND a.is_default = true LIMIT 1) AS city
    FROM users u
    ${whereSql}
    ORDER BY u.created_at DESC
  `

  try {
    const result = await db.query(sql, params)

    const header = ['Name', 'Phone', 'Email', 'City', 'Total Bookings', 'Status', 'Joined']
    const lines = [header.join(',')]

    for (const r of result.rows) {
      lines.push(
        [
          csvEscape(r.name),
          csvEscape(r.phone),
          csvEscape(r.email),
          csvEscape(r.city),
          csvEscape(r.total_bookings),
          csvEscape(r.status),
          csvEscape(new Date(r.created_at).toISOString()),
        ].join(',')
      )
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/users/export]', err)
    return NextResponse.json({ error: 'Failed to export users' }, { status: 500 })
  }
}