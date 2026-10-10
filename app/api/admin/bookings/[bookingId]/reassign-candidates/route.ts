// app/api/admin/bookings/[bookingId]/reassign-candidates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid, PRESENCE_SQL, STATUS_SQL } from '@/lib/workers-api'
import { bookingNotFound } from '@/lib/bookings-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:reassign')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const search = (req.nextUrl.searchParams.get('search') || '').trim()

  try {
    const { rows } = await db.query(
      `WITH bk AS (
         SELECT worker_id, category_id, scheduled_at,
                scheduled_at + duration_hours * interval '1 hour' AS ends_at
         FROM bookings WHERE id = $1
       )
       SELECT w.id, w.name, w.phone, w.city, w.avg_rating, w.total_reviews,
              ${PRESENCE_SQL} AS presence
       FROM workers w, bk
       WHERE w.id <> bk.worker_id
         AND w.deleted_at IS NULL
         AND w.verification_status::text = 'VERIFIED'
         AND ${STATUS_SQL} = 'active'
         AND EXISTS (
           SELECT 1 FROM worker_skills ws
           WHERE ws.worker_id = w.id AND ws.category_id = bk.category_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM bookings x
           WHERE x.worker_id = w.id
             AND x.status::text IN ('PENDING','ACCEPTED','IN_PROGRESS')
             AND tstzrange(x.scheduled_at, x.scheduled_at + x.duration_hours * interval '1 hour')
                 && tstzrange(bk.scheduled_at, bk.ends_at)
         )
         AND ($2 = '' OR w.name ILIKE '%' || $2 || '%' OR w.phone ILIKE '%' || $2 || '%')
       ORDER BY w.avg_rating DESC, w.total_bookings DESC
       LIMIT 20`,
      [bookingId, search]
    )

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        city: r.city,
        avgRating: Number(r.avg_rating ?? 0),
        totalReviews: r.total_reviews ?? 0,
        presence: r.presence,
      })),
    })
  } catch (err) {
    console.error('[GET reassign-candidates]', err)
    return NextResponse.json({ error: 'Failed to load candidate workers' }, { status: 500 })
  }
}