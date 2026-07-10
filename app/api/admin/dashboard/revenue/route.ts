import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const guard = await requirePermission('dashboard:view')
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'daily'

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  try {
    const [chartResult, cityResult] = await Promise.all([
      db.query('SELECT * FROM get_revenue_chart($1)', [period]),
      db.query('SELECT * FROM get_revenue_by_city()'),
    ])

    return NextResponse.json({
      chart: chartResult.rows,
      byCity: cityResult.rows,
    })
  } catch (err) {
    console.error('[dashboard/revenue]', err)
    return NextResponse.json({ error: 'Failed to load revenue data' }, { status: 500 })
  }
}