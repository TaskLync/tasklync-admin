// app/api/admin/workers/[workerId]/earnings/route.ts
// ASSUMES worker_earnings(worker_id, amount, created_at). If your columns differ this
// returns available:false and the card says "not wired up yet" instead of erroring.
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
       )
       SELECT
         COALESCE(sum(e.amount), 0) AS lifetime,
         COALESCE(sum(e.amount) FILTER (WHERE e.created_at >= m.this_start), 0) AS this_month,
         COALESCE(sum(e.amount) FILTER (
           WHERE e.created_at >= m.this_start - interval '1 month' AND e.created_at < m.this_start
         ), 0) AS last_month,
         (SELECT currency FROM workers WHERE id = $1) AS currency
       FROM m
       LEFT JOIN worker_earnings e ON e.worker_id = $1
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
  } catch (err: any) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json({
        available: false,
        currency: 'PKR',
        lifetime: 0,
        thisMonth: 0,
        lastMonth: 0,
      })
    }
    console.error('[GET worker earnings]', err)
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 })
  }
}