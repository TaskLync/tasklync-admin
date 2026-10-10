// app/api/admin/bookings/kpis/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermission('bookings:view')
  if (!guard.ok) return guard.response

  try {
    const result = await db.query('SELECT * FROM get_booking_kpis()')
    const row = result.rows[0]

    const today = Number(row.bookings_today)
    const yesterday = Number(row.bookings_yesterday)
    const changePct =
      yesterday === 0 ? (today === 0 ? 0 : 100) : ((today - yesterday) / yesterday) * 100

    return NextResponse.json({
      bookingsToday: today,
      bookingsTodayChangePct: changePct,
      pendingNow: Number(row.pending_now),
      inProgressNow: Number(row.in_progress_now),
      disputedNow: Number(row.disputed_now),
      createdSparkline7d: (row.created_sparkline_7d ?? []).map((n: number | string) => Number(n)),
    })
  } catch (err) {
    console.error('[GET /api/admin/bookings/kpis]', err)
    return NextResponse.json({ error: 'Failed to load booking KPIs' }, { status: 500 })
  }
}