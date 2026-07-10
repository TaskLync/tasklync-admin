import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import type { UtmBreakdownRow } from '@/types/waitlist'

export async function GET(request: Request) {
  const guard = await requirePermission('waitlist:view')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query('SELECT * FROM get_utm_breakdown()')
    const total = rows.reduce((sum: number, r: { count: string }) => sum + Number(r.count), 0)

    const payload: UtmBreakdownRow[] = rows.map((r: { utm_source: string | null; count: string }) => ({
      utm_source: r.utm_source,
      count: Number(r.count),
      pct: total === 0 ? 0 : Math.round((Number(r.count) / total) * 1000) / 10,
    }))

    return NextResponse.json({ rows: payload, total })
  } catch (error) {
    console.error('[waitlist/utm-breakdown]', error)
    return NextResponse.json({ error: 'Failed to load UTM breakdown' }, { status: 500 })
  }
}