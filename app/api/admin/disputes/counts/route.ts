// app/api/admin/disputes/counts/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { DISPUTE_SLA_AMBER_HOURS, DISPUTE_SLA_RED_HOURS } from '@/lib/dispute-constants'
import { ACTIVE_SQL, TAB_SQL, disputeErrorResponse } from '@/lib/disputes-api'
import type { DisputeCounts } from '@/types/dispute'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('disputes:view')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query(`
      SELECT
        (count(*) FILTER (WHERE ${TAB_SQL.open}))::int       AS open,
        (count(*) FILTER (WHERE ${TAB_SQL.awaiting}))::int   AS awaiting,
        (count(*) FILTER (WHERE ${TAB_SQL.escalated}))::int  AS escalated,
        (count(*) FILTER (WHERE ${TAB_SQL.resolved}))::int   AS resolved,
        (count(*) FILTER (WHERE ${ACTIVE_SQL}
           AND d.created_at < now() - interval '${DISPUTE_SLA_AMBER_HOURS} hours'))::int AS overdue_48h,
        (count(*) FILTER (WHERE ${ACTIVE_SQL}
           AND d.created_at < now() - interval '${DISPUTE_SLA_RED_HOURS} hours'))::int   AS overdue_72h
      FROM disputes d
    `)
    const r = rows[0]

    // Money refunded through disputes in the last 30 days. Missing payment tables -> 0.
    let refundedAmount30d = 0
    try {
      const refunded = await db.query(`
        SELECT COALESCE(sum(r.amount), 0) AS total
        FROM refunds r
        WHERE r.status::text = 'COMPLETED'
          AND COALESCE(r.completed_at, r.created_at) >= now() - interval '30 days'
          AND EXISTS (SELECT 1 FROM disputes d WHERE d.booking_id = r.booking_id)
      `)
      refundedAmount30d = Number(refunded.rows[0].total)
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code !== '42P01' && code !== '42703') throw err
    }

    const counts: DisputeCounts = {
      open: r.open,
      awaiting: r.awaiting,
      escalated: r.escalated,
      resolved: r.resolved,
      overdue48h: r.overdue_48h,
      overdue72h: r.overdue_72h,
      refundedAmount30d,
    }
    return NextResponse.json(counts)
  } catch (err) {
    return disputeErrorResponse(err, '[GET /api/admin/disputes/counts]')
  }
}