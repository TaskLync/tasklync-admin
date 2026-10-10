// app/api/admin/workers/verification/counts/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { QUEUE_BASE_CTE, TAB_SQL } from '@/lib/verification-api'

export async function GET() {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query(`
      ${QUEUE_BASE_CTE}
      SELECT
        (count(*) FILTER (WHERE ${TAB_SQL.pending}))::int     AS pending,
        (count(*) FILTER (WHERE ${TAB_SQL.resubmitted}))::int AS resubmitted,
        (count(*) FILTER (WHERE ${TAB_SQL.approved}))::int    AS approved,
        (count(*) FILTER (WHERE ${TAB_SQL.rejected}))::int    AS rejected,
        (count(*) FILTER (WHERE verification_status = 'pending_review'
                            AND submitted_at < now() - interval '48 hours'))::int AS overdue_48h,
        (count(*) FILTER (WHERE verification_status = 'pending_review'
                            AND submitted_at < now() - interval '72 hours'))::int AS overdue_72h
      FROM q
    `)
    const r = rows[0]
    return NextResponse.json({
      pending: r.pending,
      resubmitted: r.resubmitted,
      approved: r.approved,
      rejected: r.rejected,
      overdue48h: r.overdue_48h,
      overdue72h: r.overdue_72h,
    })
  } catch (err) {
    console.error('[GET /api/admin/workers/verification/counts]', err)
    return NextResponse.json({ error: 'Failed to load counts' }, { status: 500 })
  }
}