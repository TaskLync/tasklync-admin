// app/api/admin/analytics/cities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { parseRange } from '@/lib/analytics-constants'
import { analyticsErrorResponse, num, rate } from '@/lib/analytics-api'
import type { AnalyticsCities } from '@/types/analytics'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('analytics:view')
  if (!guard.ok) return guard.response

  const days = parseRange(req.nextUrl.searchParams.get('days'))

  try {
    const { rows } = await db.query('SELECT * FROM get_analytics_cities($1)', [days])

    const body: AnalyticsCities = {
      days,
      data: rows.map((r) => {
        const bookings = num(r.bookings)
        const workers = num(r.active_workers)
        return {
          city: r.city,
          bookings,
          completed: num(r.completed),
          completionRate: rate(num(r.completed), bookings),
          gross: num(r.gross),
          activeWorkers: workers,
          bookingsPerWorker: workers > 0 ? Math.round((bookings / workers) * 10) / 10 : null,
        }
      }),
    }
    return NextResponse.json(body)
  } catch (err) {
    return analyticsErrorResponse(err, '[GET /api/admin/analytics/cities]')
  }
}