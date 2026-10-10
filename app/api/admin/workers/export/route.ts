// app/api/admin/workers/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { buildWorkerWhere, CATEGORY_NAMES_SQL, STATUS_SQL } from '@/lib/workers-api'

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  const { whereSql, params } = buildWorkerWhere(req.nextUrl.searchParams)

  const sql = `
    SELECT
      w.name, w.phone, w.email, w.city,
      w.avg_rating, w.total_reviews, w.total_bookings, w.created_at,
      lower(w.verification_status::text) AS verification_status,
      ${STATUS_SQL} AS status,
      ${CATEGORY_NAMES_SQL} AS categories
    FROM workers w
    ${whereSql}
    ORDER BY w.created_at DESC
  `

  try {
    const result = await db.query(sql, params)

    const header = [
      'Name', 'Phone', 'Email', 'City', 'Categories',
      'Rating', 'Reviews', 'Total Jobs', 'Verification', 'Status', 'Joined',
    ]
    const lines = [header.join(',')]

    for (const r of result.rows) {
      lines.push(
        [
          csvEscape(r.name),
          csvEscape(r.phone),
          csvEscape(r.email),
          csvEscape(r.city),
          csvEscape(r.categories),
          csvEscape(Number(r.avg_rating ?? 0).toFixed(2)),
          csvEscape(r.total_reviews),
          csvEscape(r.total_bookings),
          csvEscape(r.verification_status),
          csvEscape(r.status),
          csvEscape(new Date(r.created_at).toISOString()),
        ].join(',')
      )
    }

    // BOM so Excel opens UTF-8 names correctly
    return new NextResponse('\uFEFF' + lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="workers-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/workers/export]', err)
    return NextResponse.json({ error: 'Failed to export workers' }, { status: 500 })
  }
}