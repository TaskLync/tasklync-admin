// app/api/admin/workers/[workerId]/performance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid, workerNotFound } from '@/lib/workers-api'

const MISSING = ['42P01', '42703'] // undefined_table, undefined_column

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  try {
    const { rows: base } = await db.query(
      `SELECT avg_rating, total_reviews, response_time_mins FROM workers WHERE id = $1`,
      [workerId]
    )
    if (base.length === 0) return workerNotFound()

    // Booking stats. Definitions:
    //   acceptance   = accepted / (accepted + rejected)   (pending requests don't count either way)
    //   cancellation = cancelled / all bookings received
    let booking: { accepted: number; rejected: number; cancelled: number; completed: number; received: number } | null = null
    try {
      const { rows } = await db.query(
        `SELECT
           count(*) FILTER (WHERE upper(b.status::text) IN ('ACCEPTED','IN_PROGRESS','COMPLETED','COMPLETED_BY_WORKER'))::int AS accepted,
           count(*) FILTER (WHERE upper(b.status::text) = 'REJECTED')::int  AS rejected,
           count(*) FILTER (WHERE upper(b.status::text) = 'CANCELLED')::int AS cancelled,
           count(*) FILTER (WHERE upper(b.status::text) = 'COMPLETED')::int AS completed,
           count(*)::int AS received
         FROM bookings b
         WHERE b.worker_id = $1`,
        [workerId]
      )
      booking = rows[0]
    } catch (err: any) {
      if (!MISSING.includes(err?.code)) throw err
    }

    // Star distribution from the reviews table.
    let ratingBreakdown: Record<'1' | '2' | '3' | '4' | '5', number> | null = null
    try {
      const { rows } = await db.query(
        `SELECT rating, count(*)::int AS n FROM reviews WHERE worker_id = $1 GROUP BY rating`,
        [workerId]
      )
      ratingBreakdown = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      for (const r of rows) {
        const key = String(r.rating) as '1' | '2' | '3' | '4' | '5'
        if (key in ratingBreakdown) ratingBreakdown[key] = r.n
      }
    } catch (err: any) {
      if (!MISSING.includes(err?.code)) throw err
    }

    const decided = booking ? booking.accepted + booking.rejected : 0

    return NextResponse.json({
      available: booking !== null,
      completedJobs: booking ? booking.completed : null,
      receivedJobs: booking ? booking.received : null,
      acceptanceRate: booking && decided > 0 ? (booking.accepted / decided) * 100 : null,
      cancellationRate:
        booking && booking.received > 0 ? (booking.cancelled / booking.received) * 100 : null,
      avgRating: Number(base[0].avg_rating ?? 0),
      totalReviews: base[0].total_reviews ?? 0,
      responseTimeMins: base[0].response_time_mins ?? 0,
      ratingBreakdown,
    })
  } catch (err) {
    console.error('[GET worker performance]', err)
    return NextResponse.json({ error: 'Failed to load performance' }, { status: 500 })
  }
}