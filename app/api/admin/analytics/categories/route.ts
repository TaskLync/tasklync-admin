// app/api/admin/analytics/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { parseRange } from '@/lib/analytics-constants'
import { analyticsErrorResponse, num, rate } from '@/lib/analytics-api'
import type { AnalyticsCategories } from '@/types/analytics'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('analytics:view')
  if (!guard.ok) return guard.response

  const days = parseRange(req.nextUrl.searchParams.get('days'))

  try {
    const { rows } = await db.query('SELECT * FROM get_analytics_categories($1)', [days])

    const body: AnalyticsCategories = {
      days,
      data: rows.map((r) => {
        const closed = num(r.closed)
        return {
          categoryId: r.category_id,
          categoryName: r.category_name,
          bookings: num(r.bookings),
          completed: num(r.completed),
          completionRate: rate(num(r.completed), closed),
          cancellationRate: rate(num(r.cancelled), closed),
          avgValue: r.avg_value === null ? null : num(r.avg_value),
          avgWorkerRating: r.avg_worker_rating === null ? null : Math.round(num(r.avg_worker_rating) * 10) / 10,
          topWorker: r.top_worker_id
            ? { id: r.top_worker_id, name: r.top_worker_name, jobs: num(r.top_worker_jobs) }
            : null,
        }
      }),
    }
    return NextResponse.json(body)
  } catch (err) {
    return analyticsErrorResponse(err, '[GET /api/admin/analytics/categories]')
  }
}