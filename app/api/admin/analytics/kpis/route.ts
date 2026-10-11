// app/api/admin/analytics/kpis/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { analyticsErrorResponse, deltaPts, num, pctChange, rate } from '@/lib/analytics-api'
import type { AnalyticsKpis } from '@/types/analytics'

export const dynamic = 'force-dynamic'

// 7 calendar days (Asia/Karachi) for the card sparklines.
// Range joins (not date-casts on b.created_at) so the bookings indexes are used.
const SPARK_SQL = `
  WITH t AS (SELECT (now() AT TIME ZONE 'Asia/Karachi')::date AS today)
  SELECT (t.today - n) AS day,
         count(DISTINCT b.user_id)   AS users,
         count(DISTINCT b.worker_id) AS workers,
         COALESCE(avg(b.estimated_total) FILTER (
           WHERE b.status::text IN ('COMPLETED','AUTO_COMPLETED')), 0) AS avg_value
  FROM t
  CROSS JOIN generate_series(0, 6) AS n
  LEFT JOIN bookings b
    ON b.created_at >= analytics_day_start(t.today - n)
   AND b.created_at <  analytics_day_start(t.today - n + 1)
  GROUP BY n, t.today
  ORDER BY (t.today - n)
`

type Stats = {
  activeUsers: number
  activeWorkers: number
  created: number
  decided: number
  accepted: number
  completed: number
  closed: number
  avgValue: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toStats = (o: any): Stats => ({
  activeUsers: num(o?.active_users),
  activeWorkers: num(o?.active_workers),
  created: num(o?.created),
  decided: num(o?.decided),
  accepted: num(o?.accepted),
  completed: num(o?.completed),
  closed: num(o?.closed),
  avgValue: num(o?.avg_value),
})

export async function GET() {
  const guard = await requirePermission('analytics:view')
  if (!guard.ok) return guard.response

  try {
    const [main, spark] = await Promise.all([
      db.query('SELECT get_analytics_kpis() AS data'),
      db.query(SPARK_SQL),
    ])
    const raw = main.rows[0].data

    const last24h = toStats(raw.last24h)
    const prev24h = toStats(raw.prev24h)
    const cur = toStats(raw.current)
    const prev = toStats(raw.previous)

    const completionCur = rate(cur.completed, cur.closed)
    const completionPrev = rate(prev.completed, prev.closed)
    const acceptCur = rate(cur.accepted, cur.decided)
    const acceptPrev = rate(prev.accepted, prev.decided)

    const retCur = { cohort: num(raw.retention.current?.cohort), retained: num(raw.retention.current?.retained) }
    const retPrev = { cohort: num(raw.retention.previous?.cohort), retained: num(raw.retention.previous?.retained) }
    const retentionCur = rate(retCur.retained, retCur.cohort)
    const retentionPrev = rate(retPrev.retained, retPrev.cohort)

    const sparkUsers = spark.rows.map((r) => num(r.users))
    const sparkWorkers = spark.rows.map((r) => num(r.workers))
    const sparkValue = spark.rows.map((r) => num(r.avg_value))

    const body: AnalyticsKpis = {
      currency: 'PKR',
      dau: {
        value: last24h.activeUsers,
        previous: prev24h.activeUsers,
        change: pctChange(last24h.activeUsers, prev24h.activeUsers),
        sparkline: sparkUsers,
      },
      daw: {
        value: last24h.activeWorkers,
        previous: prev24h.activeWorkers,
        change: pctChange(last24h.activeWorkers, prev24h.activeWorkers),
        sparkline: sparkWorkers,
      },
      completionRate: {
        value: completionCur,
        previous: completionPrev,
        change: deltaPts(completionCur, completionPrev),
        sparkline: [],
      },
      avgBookingValue: {
        value: cur.avgValue,
        previous: prev.avgValue,
        change: pctChange(cur.avgValue, prev.avgValue),
        sparkline: sparkValue,
      },
      acceptanceRate: {
        value: acceptCur,
        previous: acceptPrev,
        change: deltaPts(acceptCur, acceptPrev),
        sparkline: [],
      },
      retention: {
        value: retentionCur,
        previous: retentionPrev,
        change: deltaPts(retentionCur, retentionPrev),
        sparkline: [],
        cohortSize: retCur.cohort,
      },
    }
    return NextResponse.json(body)
  } catch (err) {
    return analyticsErrorResponse(err, '[GET /api/admin/analytics/kpis]')
  }
}