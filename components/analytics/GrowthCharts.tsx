// components/analytics/GrowthCharts.tsx
'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { CHART_COLORS, GROWTH_TABS, GROWTH_TAB_LABEL, type GrowthTab } from '@/lib/analytics-constants'
import { useAnalyticsGrowth } from '@/hooks/useAnalytics'
import type { AnalyticsRange } from '@/types/analytics'
import { AXIS_TICK, TOOLTIP_STYLE, compact, fmtDay, formatPkr } from './analytics-ui'

type CityChartRow = Record<string, string | number>

export default function GrowthCharts({ days }: { days: AnalyticsRange }) {
  const [tab, setTab] = useState<GrowthTab>('people')
  const { growth, isLoading, error, mutate } = useAnalyticsGrowth(days)

  const series = (growth?.series ?? []).map((p) => ({ ...p, label: fmtDay(p.date) }))
  const cityRows: CityChartRow[] = (growth?.cityTrend.rows ?? []).map((r) => ({
    ...r,
    label: fmtDay(r.date),
  }))
  const cities = growth?.cityTrend.cities ?? []

  const hasData =
    tab === 'cities'
      ? cityRows.some((r) => cities.some((c) => Number(r[c]) > 0))
      : series.some((p) =>
          tab === 'people'
            ? p.newUsers + p.newWorkers > 0
            : tab === 'bookings'
              ? p.bookingsCreated + p.bookingsCompleted + p.bookingsCancelled > 0
              : p.gross > 0
        )

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Growth</h2>
        <div className="flex gap-1 rounded-md border border-gray-200 p-0.5">
          {GROWTH_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors duration-150',
                tab === t ? 'bg-[#1F6F5F] text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {GROWTH_TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {error && !growth && (
        <p className="text-sm text-red-600">
          {error.message || "Couldn't load growth charts."}{' '}
          <button onClick={() => mutate()} className="underline">
            Retry
          </button>
        </p>
      )}
      {isLoading && !growth && <div className="h-72 animate-pulse rounded bg-gray-100" />}
      {growth && !hasData && (
        <p className="py-8 text-center text-sm text-gray-400">No activity in the last {days} days.</p>
      )}

      {growth && hasData && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {tab === 'people' ? (
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="newUsers" name="New users" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="newWorkers" name="New workers" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            ) : tab === 'bookings' ? (
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="bookingsCreated" name="Created" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bookingsCompleted" name="Completed" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bookingsCancelled" name="Cancelled / rejected" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              </LineChart>
            ) : tab === 'revenue' ? (
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} tickFormatter={compact} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatPkr(Number(value ?? 0))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="gross" name="Daily gross revenue" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="grossMa7"
                  name="7-day moving average"
                  stroke={CHART_COLORS[2]}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </LineChart>
            ) : (
              <AreaChart data={cityRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {cities.map((c, i) => (
                  <Area
                    key={c}
                    type="monotone"
                    dataKey={c}
                    name={c}
                    stackId="cities"
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.35}
                  />
                ))}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-gray-400">
        {tab === 'revenue'
          ? 'Gross value of bookings completed that day (by completion time).'
          : tab === 'cities'
            ? 'Bookings created per day, by job-site city (falls back to the worker’s city).'
            : tab === 'bookings'
              ? 'Created by creation day. Completed and cancelled by the day they reached that state.'
              : 'New registrations per day.'}
      </p>
    </Card>
  )
}