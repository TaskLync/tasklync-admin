// app/api/admin/workers/[workerId]/availability/route.ts
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
    const [recurringRes, blockedRes] = await Promise.all([
      db.query(
        `SELECT day_of_week, left(start_time::text, 5) AS start_time, left(end_time::text, 5) AS end_time
         FROM worker_recurring_availability
         WHERE worker_id = $1 AND is_active = true
         ORDER BY day_of_week`,
        [workerId]
      ),
      db.query(
        `SELECT id, blocked_date::text AS blocked_date,
                left(start_time::text, 5) AS start_time,
                left(end_time::text, 5) AS end_time,
                reason
         FROM worker_blocked_dates
         WHERE worker_id = $1 AND blocked_date >= CURRENT_DATE
         ORDER BY blocked_date
         LIMIT 30`,
        [workerId]
      ),
    ])

    return NextResponse.json({
      recurring: recurringRes.rows.map((r) => ({
        dayOfWeek: r.day_of_week,
        startTime: r.start_time,
        endTime: r.end_time,
      })),
      blocked: blockedRes.rows.map((r) => ({
        id: r.id,
        blockedDate: r.blocked_date,
        startTime: r.start_time,
        endTime: r.end_time,
        reason: r.reason,
      })),
    })
  } catch (err: any) {
    if (err?.code === '42P01') {
      return NextResponse.json({ recurring: [], blocked: [] })
    }
    console.error('[GET worker availability]', err)
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 })
  }
}