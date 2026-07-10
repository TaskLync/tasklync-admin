import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import type { WaitlistGrowthPeriod, WaitlistGrowthPoint } from '@/types/waitlist'

const BUCKET_COUNT: Record<WaitlistGrowthPeriod, number> = {
  daily: 30,
  weekly: 12,
  monthly: 12,
}

export async function GET(request: Request) {
  const guard = await requirePermission('waitlist:view')
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const period = (searchParams.get('period') ?? 'daily') as WaitlistGrowthPeriod

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  try {
    const { rows } = await db.query('SELECT * FROM get_waitlist_growth($1, $2)', [
      period,
      BUCKET_COUNT[period],
    ])

    const baseResult = await db.query('SELECT COUNT(*) FROM waitlist WHERE created_at < $1', [
      rows[0]?.bucket ?? new Date(),
    ])
    let cumulative = Number(baseResult.rows[0]?.count ?? 0)

    const chart: WaitlistGrowthPoint[] = rows.map((row: { bucket: string; signups: string }) => {
      cumulative += Number(row.signups)
      return { bucket: row.bucket, signups: Number(row.signups), cumulative }
    })

    return NextResponse.json({ chart, period })
  } catch (error) {
    console.error('[waitlist/growth]', error)
    return NextResponse.json({ error: 'Failed to load waitlist growth' }, { status: 500 })
  }
}