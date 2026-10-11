// components/analytics/AnalyticsSection.tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ANALYTICS_RANGES, DEFAULT_ANALYTICS_RANGE } from '@/lib/analytics-constants'
import type { AnalyticsRange } from '@/types/analytics'
import AnalyticsKpiGrid from './AnalyticsKpiGrid'
import GrowthCharts from './GrowthCharts'
import FunnelCharts from './FunnelCharts'
import CityPerformance from './CityPerformance'
import CategoryPerformance from './CategoryPerformance'

export default function AnalyticsSection() {
  const [days, setDays] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE)

  return (
    <div className="flex flex-col gap-5">
      {/* KPI row is always the last 7 days vs the 7 before. The range below drives everything under it. */}
      <AnalyticsKpiGrid />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Trends &amp; breakdowns</h2>
          <p className="text-xs text-gray-400">Applies to the charts and tables below. Days are Asia/Karachi.</p>
        </div>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-0.5">
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors duration-150',
                days === r ? 'bg-[#1F6F5F] text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      <GrowthCharts days={days} />
      <FunnelCharts days={days} />
      <CityPerformance days={days} />
      <CategoryPerformance days={days} />
    </div>
  )
}