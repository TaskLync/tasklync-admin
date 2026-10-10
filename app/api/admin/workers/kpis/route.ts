// app/api/admin/workers/kpis/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export async function GET() {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  try {
    const result = await db.query('SELECT * FROM get_worker_kpis()')
    const row = result.rows[0]

    const signupsToday = Number(row.signups_today)
    const signupsYesterday = Number(row.signups_yesterday)
    const signupsTodayChangePct =
      signupsYesterday === 0
        ? signupsToday === 0
          ? 0
          : 100
        : ((signupsToday - signupsYesterday) / signupsYesterday) * 100

    return NextResponse.json({
      totalWorkers: Number(row.total_workers),
      signupsToday,
      signupsTodayChangePct,
      onlineNow: Number(row.online_now),
      suspendedOrBanned: Number(row.suspended_or_banned),
      signupsSparkline7d: (row.signups_sparkline_7d ?? []).map((n: number | string) => Number(n)),
    })
  } catch (err) {
    console.error('[GET /api/admin/workers/kpis]', err)
    return NextResponse.json({ error: 'Failed to load worker KPIs' }, { status: 500 })
  }
}