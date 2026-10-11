// lib/analytics-api.ts
// Server-only helpers for the /api/admin/analytics/* routes.
import { NextResponse } from 'next/server'

export const num = (v: unknown) => Number(v ?? 0)

/** % change. Same convention as the dashboard/workers/users KPIs (prev 0 -> 100 or 0). */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** Percentage 0-100 with one decimal, or null when there is nothing to divide by. */
export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null
}

/** Difference in percentage points, null if either side is unknown. */
export function deltaPts(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null
  return Math.round((current - previous) * 10) / 10
}

export function analyticsErrorResponse(err: unknown, tag: string) {
  const code = (err as { code?: string } | null)?.code
  console.error(tag, err)
  // 42883 = undefined_function, 42P01 = undefined_table, 42703 = undefined_column
  if (code === '42883' || code === '42P01' || code === '42703') {
    return NextResponse.json(
      {
        error:
          'Analytics functions are missing or out of date. Run db/migrations/011_analytics.sql on the shared database.',
      },
      { status: 503 }
    )
  }
  return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
}