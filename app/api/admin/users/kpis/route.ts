// app/api/admin/users/kpis/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export async function GET() {
  const guard = await requirePermission('users:view')
  if (!guard.ok) return guard.response

  try {
    const result = await db.query('SELECT * FROM get_user_kpis()')
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
      totalUsers: Number(row.total_users),
      signupsToday,
      signupsTodayChangePct,
      activeUsers: Number(row.active_users),
      suspendedOrBanned: Number(row.suspended_or_banned),
      signupsSparkline7d: (row.signups_sparkline_7d ?? []).map((n: number) => Number(n)),
    })
  } catch (err) {
    console.error('[GET /api/admin/users/kpis]', err)
    return NextResponse.json({ error: 'Failed to load user KPIs' }, { status: 500 })
  }
}