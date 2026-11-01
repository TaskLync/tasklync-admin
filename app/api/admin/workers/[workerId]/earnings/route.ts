// app/api/admin/workers/[workerId]/earnings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  try {
    const { rows } = await db.query(
      `WITH m AS (
         SELECT (date_trunc('month', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi') AS this_start
       ), done AS (
         SELECT b.worker_amount, COALESCE(b.completed_at, b.updated_at) AS at
           FROM bookings b
          WHERE b.worker_id = $1 AND b.status::text IN ('COMPLETED', 'AUTO_COMPLETED')
       )
       SELECT
         COALESCE(sum(d.worker_amount), 0) AS lifetime,
         COALESCE(sum(d.worker_amount) FILTER (WHERE d.at >= m.this_start), 0) AS this_month,
         COALESCE(sum(d.worker_amount) FILTER (
           WHERE d.at >= m.this_start - interval '1 month' AND d.at < m.this_start), 0) AS last_month,
         (SELECT currency FROM workers WHERE id = $1) AS currency
       FROM m LEFT JOIN done d ON true
       GROUP BY m.this_start`,
      [workerId]
    )
    const r = rows[0]
    return NextResponse.json({
      available: true,
      currency: r?.currency ?? 'PKR',
      lifetime: Number(r?.lifetime ?? 0),
      thisMonth: Number(r?.this_month ?? 0),
      lastMonth: Number(r?.last_month ?? 0),
    })
  } catch (err) {
    console.error('[GET worker earnings]', err)
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 })
  }
}