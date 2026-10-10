// app/api/admin/bookings/[bookingId]/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid } from '@/lib/workers-api'
import { bookingNotFound } from '@/lib/bookings-api'

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
      `SELECT id, from_status, to_status, actor, is_backfilled, changed_at
       FROM booking_status_history
       WHERE booking_id = $1
       ORDER BY changed_at ASC, id ASC`,
      [bookingId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: Number(r.id),
        fromStatus: r.from_status,
        toStatus: r.to_status,
        actor: r.actor,
        isBackfilled: r.is_backfilled,
        changedAt: r.changed_at,
      })),
    })
  } catch (err: any) {
    // migration 008 not applied yet
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json({ available: false, data: [] })
    }
    console.error('[GET booking timeline]', err)
    return NextResponse.json({ error: 'Failed to load the status history' }, { status: 500 })
  }
}