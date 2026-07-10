// components/dashboard/RevenueChart.tsx
'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useRevenueChart } from '@/hooks/useDashboard'
import type { RevenuePeriod } from '@/types/dashboard'

const PERIODS: { label: string; value: RevenuePeriod }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

export function RevenueChart() {
  const [period, setPeriod] = useState<RevenuePeriod>('daily')
  const { data, error, isLoading } = useRevenueChart(period)

  const chartData = (data?.chart ?? []).map((point) => ({
    date: new Date(point.bucket).toLocaleDateString('en-PK', {
      month: 'short',
      day: 'numeric',
    }),
    gross: Number(point.gross_revenue),
    fees: Number(point.platform_fees),
  }))

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Revenue
        </h2>
        <div className="flex gap-1 rounded-md border border-gray-200 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors duration-150',
                period === p.value
                  ? 'bg-[#1F6F5F] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">Couldn't load revenue chart.</p>}

      {isLoading && !data && (
        <div className="h-64 animate-pulse rounded bg-gray-100" />
      )}

      {data && chartData.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">No revenue data yet.</p>
      )}

      {data && chartData.length > 0 && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
              formatter={(value) => `PKR ${Number(value ?? 0).toLocaleString()}`}
/>
              <Line type="monotone" dataKey="gross" stroke="#1F6F5F" strokeWidth={2} dot={false} name="Gross Revenue" />
              <Line type="monotone" dataKey="fees" stroke="#2563EB" strokeWidth={2} dot={false} name="Platform Fees" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data && data.byCity.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <th className="py-1.5 text-left font-medium">City</th>
              <th className="py-1.5 text-right font-medium">Revenue</th>
              <th className="py-1.5 text-right font-medium">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {data.byCity.map((row) => (
              <tr key={row.city} className="even:bg-gray-50">
                <td className="py-1.5 text-gray-800">{row.city}</td>
                <td className="py-1.5 text-right text-gray-800">
                  PKR {Number(row.gross_revenue).toLocaleString()}
                </td>
                <td className="py-1.5 text-right text-gray-500">{row.bookings_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}