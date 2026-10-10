// components/payments/PaymentRevenueChart.tsx
'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useRevenueSeries } from '@/hooks/usePayments'
import { formatPkr } from './payment-ui'

const RANGES: { label: string; value: 30 | 90 }[] = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

export default function PaymentRevenueChart() {
  const [days, setDays] = useState<30 | 90>(90)
  const { series, isLoading, error } = useRevenueSeries(days)

  const chartData = (series?.chart ?? []).map((p) => ({
    date: new Date(p.date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }),
    gross: p.gross,
    fees: p.fees,
    worker: p.workerAmount,
  }))
  const hasData = chartData.some((p) => p.gross > 0)

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Revenue</h2>
        <div className="flex gap-1 rounded-md border border-gray-200 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors duration-150',
                days === r.value ? 'bg-[#1F6F5F] text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && !series && <p className="text-sm text-red-600">Couldn't load revenue chart.</p>}
      {isLoading && !series && <div className="h-64 animate-pulse rounded bg-gray-100" />}

      {series && !hasData && (
        <p className="py-8 text-center text-sm text-gray-400">
          No completed bookings in the last {days} days.
        </p>
      )}

      {series && hasData && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                formatter={(value) => `PKR ${Number(value ?? 0).toLocaleString()}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="gross" stroke="#1F6F5F" strokeWidth={2} dot={false} name="Gross booking value" />
              <Line type="monotone" dataKey="fees" stroke="#2563EB" strokeWidth={2} dot={false} name="Platform fees" />
              <Line type="monotone" dataKey="worker" stroke="#D97706" strokeWidth={2} dot={false} name="Worker amount" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {series && series.byCity.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <th className="py-1.5 text-left font-medium">City ({days}d)</th>
              <th className="py-1.5 text-right font-medium">Gross</th>
              <th className="py-1.5 text-right font-medium">Platform fees</th>
              <th className="py-1.5 text-right font-medium">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {series.byCity.map((row) => (
              <tr key={row.city} className="even:bg-gray-50">
                <td className="py-1.5 text-gray-800">{row.city}</td>
                <td className="py-1.5 text-right text-gray-800">{formatPkr(row.gross)}</td>
                <td className="py-1.5 text-right text-gray-800">{formatPkr(row.fees)}</td>
                <td className="py-1.5 text-right text-gray-500">{row.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}