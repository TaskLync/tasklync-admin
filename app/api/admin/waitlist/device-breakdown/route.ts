import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { parseUserAgent } from '@/lib/parse-user-agent'
import type { DeviceBreakdownRow } from '@/types/waitlist'

function toRows(counts: Record<string, number>, total: number): DeviceBreakdownRow[] {
  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      pct: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
}

export async function GET(request: Request) {
  const guard = await requirePermission('waitlist:view')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query(
      'SELECT user_agent FROM waitlist WHERE user_agent IS NOT NULL LIMIT 20000'
    )

    const deviceCounts: Record<string, number> = {}
    const browserCounts: Record<string, number> = {}
    const osCounts: Record<string, number> = {}

    for (const row of rows as { user_agent: string }[]) {
      const parsed = parseUserAgent(row.user_agent)
      deviceCounts[parsed.deviceType] = (deviceCounts[parsed.deviceType] ?? 0) + 1
      if (!parsed.isBot) {
        browserCounts[parsed.browser] = (browserCounts[parsed.browser] ?? 0) + 1
        osCounts[parsed.os] = (osCounts[parsed.os] ?? 0) + 1
      }
    }

    const total = rows.length
    const humanTotal = total - (deviceCounts['Bot / API client'] ?? 0)

    return NextResponse.json({
      device: toRows(deviceCounts, total),
      browser: toRows(browserCounts, humanTotal),
      os: toRows(osCounts, humanTotal),
      sampledFrom: total,
    })
  } catch (error) {
    console.error('[waitlist/device-breakdown]', error)
    return NextResponse.json({ error: 'Failed to load device breakdown' }, { status: 500 })
  }
}