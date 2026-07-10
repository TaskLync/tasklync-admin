// components/waitlist/WaitlistGrowthChart.tsx
'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useWaitlistGrowth } from '@/hooks/useWaitlist'
import type { WaitlistGrowthPeriod } from '@/types/waitlist'

const PERIODS: { label: string; value: WaitlistGrowthPeriod }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

export function WaitlistGrowthChart() {
  const [period, setPeriod] = useState<WaitlistGrowthPeriod>('daily')
  const { data, error, isLoading } = useWaitlistGrowth(period)

  const chartData = (data?.chart ?? []).map((point) => ({
    date: new Date(point.bucket).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }),
    signups: point.signups,
    cumulative: point.cumulative,
  }))

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Waitlist Growth
        </h2>
        <div className="flex gap-1 rounded-md border border-gray-200 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors duration-150',
                period === p.value ? 'bg-[#1F6F5F] text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">Couldn't load growth chart.</p>}

      {isLoading && !data && <div className="h-72 animate-pulse rounded bg-gray-100" />}

      {data && chartData.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">No signups in this range yet.</p>
      )}

      {data && chartData.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Bar
                yAxisId="left"
                dataKey="signups"
                fill="#1F6F5F"
                radius={[4, 4, 0, 0]}
                name="New Signups"
                barSize={18}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="#2563EB"
                strokeWidth={2}
                dot={false}
                name="Cumulative"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}