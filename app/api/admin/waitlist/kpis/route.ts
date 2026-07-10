import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import type { WaitlistKpis } from '@/types/waitlist'

export async function GET(request: Request) {
  const guard = await requirePermission('waitlist:view')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query('SELECT * FROM get_waitlist_kpis()')
    const r = rows[0]

    const sparklineResult = await db.query(
      `SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
       FROM waitlist
       WHERE created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY 1`
    )
    const byDay = new Map<string, number>(
      sparklineResult.rows.map((row) => [
        new Date(row.day).toISOString().slice(0, 10),
        Number(row.count),
      ])
    )
    const sparkline_7d: number[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      sparkline_7d.push(byDay.get(d.toISOString().slice(0, 10)) ?? 0)
    }

    const topSourceResult = await db.query(
      `SELECT COALESCE(utm_source, 'direct') AS source, COUNT(*) AS count
       FROM waitlist
       GROUP BY 1
       ORDER BY count DESC
       LIMIT 1`
    )

    const pctChange = (today: number, prev: number) =>
      prev === 0 ? (today > 0 ? 100 : 0) : Math.round(((today - prev) / prev) * 1000) / 10

    const payload: WaitlistKpis = {
      total_signups: Number(r.total_signups),
      signups_today: Number(r.signups_today),
      signups_today_change_pct: pctChange(Number(r.signups_today), Number(r.signups_yesterday)),
      signups_this_week: Number(r.signups_this_week),
      signups_this_week_change_pct: pctChange(
        Number(r.signups_this_week),
        Number(r.signups_last_week)
      ),
      pending_count: Number(r.pending_count),
      invited_count: Number(r.invited_count),
      converted_count: Number(r.converted_count),
      conversion_rate:
        Number(r.total_signups) === 0
          ? 0
          : Math.round((Number(r.converted_count) / Number(r.total_signups)) * 1000) / 10,
      top_utm_source: topSourceResult.rows[0]?.source ?? null,
      sparkline_7d,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('[waitlist/kpis]', error)
    return NextResponse.json({ error: 'Failed to load waitlist KPIs' }, { status: 500 })
  }
}