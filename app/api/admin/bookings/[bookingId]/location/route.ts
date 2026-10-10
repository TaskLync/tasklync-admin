// app/api/admin/bookings/[bookingId]/location/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid } from '@/lib/workers-api'
import { bookingNotFound } from '@/lib/bookings-api'

// ⚠️ ASSUMPTION: adjust table / column names to worker-service's real GPS history table.
const TRAIL_SQL = `
  SELECT ST_Y(l.location::geometry) AS lat,
         ST_X(l.location::geometry) AS lng,
         l.recorded_at
  FROM worker_location_history l
  WHERE l.worker_id = $1 AND l.recorded_at >= $2 AND l.recorded_at <= $3
  ORDER BY l.recorded_at ASC
  LIMIT 500
`

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:view')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  try {
    const { rows } = await db.query(
      `SELECT worker_id, scheduled_at, completed_at,
              ST_Y(job_site_location::geometry) AS lat,
              ST_X(job_site_location::geometry) AS lng
       FROM bookings WHERE id = $1`,
      [bookingId]
    )
    if (rows.length === 0) return bookingNotFound()
    const b = rows[0]

    const jobSite =
      b.lat !== null && b.lng !== null ? { lat: Number(b.lat), lng: Number(b.lng) } : null

    let trailAvailable = true
    let trail: { lat: number; lng: number; recordedAt: string }[] = []
    try {
      const from = new Date(new Date(b.scheduled_at).getTime() - 60 * 60 * 1000)
      const to = b.completed_at ? new Date(b.completed_at) : new Date()
      const trailRes = await db.query(TRAIL_SQL, [b.worker_id, from, to])
      trail = trailRes.rows.map((r) => ({
        lat: Number(r.lat),
        lng: Number(r.lng),
        recordedAt: r.recorded_at,
      }))
    } catch (err: any) {
      if (err?.code !== '42P01' && err?.code !== '42703') throw err
      trailAvailable = false
    }

    return NextResponse.json({ jobSite, trailAvailable, trail })
  } catch (err) {
    console.error('[GET booking location]', err)
    return NextResponse.json({ error: 'Failed to load location data' }, { status: 500 })
  }
}