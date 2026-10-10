// app/api/admin/bookings/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { FROM_SQL, LIST_COLUMNS_SQL, buildBookingWhere, toWhereSql } from '@/lib/bookings-api'

const MAX_ROWS = 20_000

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const guard = await requirePermission('bookings:view')
  if (!guard.ok) return guard.response

  const { where, params } = buildBookingWhere(req.nextUrl.searchParams)

  const sql = `
    SELECT ${LIST_COLUMNS_SQL}, b.platform_fee
    ${FROM_SQL}
    ${toWhereSql(where)}
    ORDER BY b.created_at DESC
    LIMIT ${MAX_ROWS}
  `

  try {
    const result = await db.query(sql, params)

    const header = [
      'Booking ID', 'Status', 'Customer', 'Customer Phone', 'Worker', 'Worker Phone',
      'Category', 'City', 'Scheduled', 'Duration (h)', 'Amount', 'Platform Fee',
      'Currency', 'Payment', 'Urgent', 'Has Dispute', 'Created',
    ]
    const lines = [header.join(',')]

    for (const r of result.rows) {
      lines.push(
        [
          csvEscape(r.id),
          csvEscape(r.status),
          csvEscape(r.user_name),
          csvEscape(r.user_phone),
          csvEscape(r.worker_name),
          csvEscape(r.worker_phone),
          csvEscape(r.category_name ?? r.category_id),
          csvEscape(r.city),
          csvEscape(new Date(r.scheduled_at).toISOString()),
          csvEscape(Number(r.duration_hours)),
          csvEscape(Number(r.estimated_total).toFixed(2)),
          csvEscape(Number(r.platform_fee).toFixed(2)),
          csvEscape(r.currency),
          csvEscape(r.payment_status),
          csvEscape(r.is_urgent ? 'yes' : 'no'),
          csvEscape(r.has_dispute ? 'yes' : 'no'),
          csvEscape(new Date(r.created_at).toISOString()),
        ].join(',')
      )
    }

    // BOM so Excel opens UTF-8 names correctly
    return new NextResponse('\uFEFF' + lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bookings-export-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/bookings/export]', err)
    return NextResponse.json({ error: 'Failed to export bookings' }, { status: 500 })
  }
}