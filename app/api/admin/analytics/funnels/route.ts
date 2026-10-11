// app/api/admin/analytics/funnels/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { parseRange } from '@/lib/analytics-constants'
import { analyticsErrorResponse, num } from '@/lib/analytics-api'
import type { AnalyticsFunnels, FunnelStage } from '@/types/analytics'

export const dynamic = 'force-dynamic'

function buildStages(steps: [label: string, count: number][]): FunnelStage[] {
  const start = steps[0]?.[1] ?? 0
  return steps.map(([stage, count], i) => {
    const prev = i === 0 ? count : steps[i - 1][1]
    return {
      stage,
      count,
      pctOfStart: start > 0 ? Math.round((count / start) * 1000) / 10 : 0,
      dropOffPct: i === 0 || prev === 0 ? 0 : Math.round((1 - count / prev) * 1000) / 10,
    }
  })
}

export async function GET(req: NextRequest) {
  const guard = await requirePermission('analytics:view')
  if (!guard.ok) return guard.response

  const days = parseRange(req.nextUrl.searchParams.get('days'))

  try {
    const { rows } = await db.query('SELECT get_analytics_funnels($1) AS data', [days])
    const d = rows[0].data

    const body: AnalyticsFunnels = {
      days,
      user: buildStages([
        ['Registered', num(d.user.registered)],
        ['Created a booking', num(d.user.booked)],
        ['Booking accepted', num(d.user.accepted)],
        ['Booking completed', num(d.user.completed)],
        ['Booked again', num(d.user.repeated)],
      ]),
      worker: buildStages([
        ['Registered', num(d.worker.registered)],
        ['Submitted documents', num(d.worker.submitted)],
        ['Verified', num(d.worker.verified)],
        ['Went online', num(d.worker.online)],
        ['Accepted a booking', num(d.worker.accepted)],
        ['Completed a booking', num(d.worker.completed)],
      ]),
    }
    return NextResponse.json(body)
  } catch (err) {
    return analyticsErrorResponse(err, '[GET /api/admin/analytics/funnels]')
  }
}