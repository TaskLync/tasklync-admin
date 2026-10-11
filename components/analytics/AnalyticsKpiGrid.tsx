// components/analytics/AnalyticsKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { useAnalyticsKpis } from '@/hooks/useAnalytics'
import type { KpiMetric } from '@/types/analytics'
import { formatPkr } from './analytics-ui'

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

const asCount = (m: KpiMetric) => (m.value === null ? '—' : m.value.toLocaleString('en-PK'))
const asPct = (m: KpiMetric) => (m.value === null ? '—' : `${m.value.toFixed(1)}%`)

export default function AnalyticsKpiGrid() {
  const { kpis, error, isLoading, mutate } = useAnalyticsKpis()

  if (error && !kpis) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error.message || "Couldn't load analytics KPIs."}{' '}
        <button onClick={() => mutate()} className="underline">
          Retry
        </button>
      </div>
    )
  }

  if (isLoading || !kpis) {
    return (
      <div className={GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={GRID}>
        <KpiCard
          label="DAU (last 24h)"
          value={asCount(kpis.dau)}
          changePct={kpis.dau.change}
          changeLabel="% vs previous 24h"
          sparkline={kpis.dau.sparkline}
          color="#1F6F5F"
        />
        <KpiCard
          label="DAW (last 24h)"
          value={asCount(kpis.daw)}
          changePct={kpis.daw.change}
          changeLabel="% vs previous 24h"
          sparkline={kpis.daw.sparkline}
          color="#2563EB"
        />
        <KpiCard
          label="Booking completion rate"
          value={asPct(kpis.completionRate)}
          changePct={kpis.completionRate.change}
          changeLabel=" pts vs previous 7 days"
          color="#16A34A"
        />
        <KpiCard
          label="Avg booking value"
          value={kpis.avgBookingValue.value === null ? '—' : formatPkr(Math.round(kpis.avgBookingValue.value), kpis.currency)}
          changePct={kpis.avgBookingValue.change}
          changeLabel="% vs previous 7 days"
          sparkline={kpis.avgBookingValue.sparkline}
          color="#D97706"
        />
        <KpiCard
          label="Worker acceptance rate"
          value={asPct(kpis.acceptanceRate)}
          changePct={kpis.acceptanceRate.change}
          changeLabel=" pts vs previous 7 days"
          color="#7C3AED"
        />
        <KpiCard
          label="7-day user retention"
          value={asPct(kpis.retention)}
          changePct={kpis.retention.change}
          changeLabel=" pts vs previous cohort"
          color="#DC2626"
        />
      </div>
      <p className="text-xs text-gray-400">
        DAU/DAW count people with a booking created in the last 24 hours (no session tracking yet). Rates and value use the last 7 days vs the 7 before.
        Retention: of {kpis.retention.cohortSize.toLocaleString('en-PK')} users whose first booking was 7 to 14 days ago, the share who booked again within 7 days of it.
      </p>
    </div>
  )
}