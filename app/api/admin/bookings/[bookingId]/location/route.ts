// app/api/admin/bookings/[bookingId]/location/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid } from '@/lib/workers-api'
import { bookingNotFound } from '@/lib/bookings-api'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

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
      `SELECT ST_Y(job_site_location::geometry) AS lat, ST_X(job_site_location::geometry) AS lng,
              arrived_at, arrival_distance_meters, start_method, start_distance_meters,
              start_gps_accuracy_meters, completion_distance_meters,
              cash_collected_amount, estimated_total, completion_photo_urls
       FROM bookings WHERE id = $1`,
      [bookingId]
    )
    if (rows.length === 0) return bookingNotFound()
    const b = rows[0]

    return NextResponse.json({
      jobSite: b.lat !== null && b.lng !== null ? { lat: Number(b.lat), lng: Number(b.lng) } : null,
      // The worker-service keeps ONE live position per worker, no history. The proof below is what booking-service stored.
      trailAvailable: false,
      trail: [],
      proof: {
        arrivedAt: b.arrived_at,
        arrivalDistanceMeters: num(b.arrival_distance_meters),
        startMethod: b.start_method,
        startDistanceMeters: num(b.start_distance_meters),
        startGpsAccuracyMeters: num(b.start_gps_accuracy_meters),
        completionDistanceMeters: num(b.completion_distance_meters),
        cashCollectedAmount: num(b.cash_collected_amount),
        estimatedTotal: num(b.estimated_total),
        completionPhotoUrls: b.completion_photo_urls ?? [],
      },
    })
  } catch (err) {
    console.error('[GET booking location]', err)
    return NextResponse.json({ error: 'Failed to load location data' }, { status: 500 })
  }
}