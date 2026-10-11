// components/analytics/CityPerformance.tsx
'use client'

import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import {
  CHART_COLORS,
  CITY_METRICS,
  CITY_METRIC_LABEL,
  type CityMetric,
} from '@/lib/analytics-constants'
import { useAnalyticsCities } from '@/hooks/useAnalytics'
import type { AnalyticsRange } from '@/types/analytics'
import { AXIS_TICK, TOOLTIP_STYLE, compact, formatPkr } from './analytics-ui'

export default function CityPerformance({ days }: { days: AnalyticsRange }) {
  const [metric, setMetric] = useState<CityMetric>('bookings')
  const { cities, isLoading, error, mutate } = useAnalyticsCities(days)

  const rows = cities?.data ?? []
  const chartData = [...rows]
    .sort((a, b) => b[metric] - a[metric])
    .map((r) => ({ city: r.city, value: r[metric] }))
  const hasData = chartData.some((r) => r.value > 0)

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">City performance</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Bookings created in the last {days} days. Active workers = verified and active right now.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-gray-200 p-0.5">
          {CITY_METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors duration-150',
                metric === m ? 'bg-[#1F6F5F] text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {CITY_METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {error && !cities && (
        <p className="text-sm text-red-600">
          {error.message || "Couldn't load city performance."}{' '}
          <button onClick={() => mutate()} className="underline">
            Retry
          </button>
        </p>
      )}
      {isLoading && !cities && <div className="h-56 animate-pulse rounded bg-gray-100" />}
      {cities && !hasData && (
        <p className="py-8 text-center text-sm text-gray-400">No city activity in this period.</p>
      )}

      {cities && hasData && (
        <div style={{ height: Math.max(180, chartData.length * 34 + 20) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={metric === 'gross' ? compact : undefined}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="city"
                tick={{ fontSize: 12, fill: '#374151' }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) =>
                  metric === 'gross' ? formatPkr(Number(value ?? 0)) : Number(value ?? 0).toLocaleString()
                }
              />
              <Bar dataKey="value" name={CITY_METRIC_LABEL[metric]} radius={[0, 4, 4, 0]} barSize={16}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {cities && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <th className="py-1.5 text-left font-medium">City</th>
                <th className="py-1.5 text-right font-medium">Bookings</th>
                <th className="py-1.5 text-right font-medium">Completed</th>
                <th className="py-1.5 text-right font-medium">Completed % of bookings</th>
                <th className="py-1.5 text-right font-medium">Revenue</th>
                <th className="py-1.5 text-right font-medium">Active workers</th>
                <th className="py-1.5 text-right font-medium">Bookings / worker</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.city} className="even:bg-gray-50">
                  <td className="py-1.5 text-gray-800">{r.city}</td>
                  <td className="py-1.5 text-right text-gray-800">{r.bookings.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-gray-500">{r.completed.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-gray-500">
                    {r.completionRate === null ? '—' : `${r.completionRate}%`}
                  </td>
                  <td className="py-1.5 text-right text-gray-800">{formatPkr(r.gross)}</td>
                  <td className="py-1.5 text-right text-gray-500">{r.activeWorkers.toLocaleString()}</td>
                  <td
                    className={cn(
                      'py-1.5 text-right',
                      r.bookingsPerWorker !== null && r.bookingsPerWorker >= 10
                        ? 'font-medium text-[#DC2626]'
                        : 'text-gray-500'
                    )}
                    title={
                      r.bookingsPerWorker !== null && r.bookingsPerWorker >= 10
                        ? 'High load per worker: consider recruiting here'
                        : undefined
                    }
                  >
                    {r.bookingsPerWorker === null ? (r.bookings > 0 ? 'No workers' : '—') : r.bookingsPerWorker}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}