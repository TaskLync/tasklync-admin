// app/api/admin/analytics/growth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { parseRange } from '@/lib/analytics-constants'
import { analyticsErrorResponse, num } from '@/lib/analytics-api'
import type { AnalyticsGrowth, CityTrendRow } from '@/types/analytics'

export const dynamic = 'force-dynamic'

const MAX_CITY_SERIES = 6

export async function GET(req: NextRequest) {
  const guard = await requirePermission('analytics:view')
  if (!guard.ok) return guard.response

  const days = parseRange(req.nextUrl.searchParams.get('days'))

  try {
    // to_char keeps the Karachi calendar day as a plain string (no JS Date timezone shifts)
    const [growth, trend] = await Promise.all([
      db.query(
        `SELECT to_char(bucket, 'YYYY-MM-DD') AS date, new_users, new_workers,
                bookings_created, bookings_completed, bookings_cancelled, gross_revenue, gross_ma7
         FROM get_analytics_growth($1)`,
        [days]
      ),
      db.query(
        `SELECT to_char(bucket, 'YYYY-MM-DD') AS date, city, bookings
         FROM get_analytics_city_trend($1)`,
        [days]
      ),
    ])

    const series = growth.rows.map((r) => ({
      date: r.date as string,
      newUsers: num(r.new_users),
      newWorkers: num(r.new_workers),
      bookingsCreated: num(r.bookings_created),
      bookingsCompleted: num(r.bookings_completed),
      bookingsCancelled: num(r.bookings_cancelled),
      gross: num(r.gross_revenue),
      grossMa7: num(r.gross_ma7),
    }))

    // Top N cities by volume, everything else folded into "Other"
    const totals = new Map<string, number>()
    for (const r of trend.rows) totals.set(r.city, (totals.get(r.city) ?? 0) + num(r.bookings))
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
    const top = ranked.slice(0, MAX_CITY_SERIES)
    const hasOther = ranked.length > MAX_CITY_SERIES
    const cities = hasOther && !top.includes('Other') ? [...top, 'Other'] : top

    const byDate = new Map<string, CityTrendRow>()
    for (const s of series) {
      const row: CityTrendRow = { date: s.date }
      for (const c of cities) row[c] = 0
      byDate.set(s.date, row)
    }
    for (const r of trend.rows) {
      const row = byDate.get(r.date)
      if (!row) continue
      const key = top.includes(r.city) ? r.city : 'Other'
      if (!cities.includes(key)) continue
      row[key] = (row[key] as number) + num(r.bookings)
    }

    const body: AnalyticsGrowth = {
      days,
      series,
      cityTrend: { cities, rows: [...byDate.values()] },
    }
    return NextResponse.json(body)
  } catch (err) {
    return analyticsErrorResponse(err, '[GET /api/admin/analytics/growth]')
  }
}