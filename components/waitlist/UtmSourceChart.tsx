// components/waitlist/UtmSourceChart.tsx
'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { Card } from '@/components/ui/Card'
import { useUtmBreakdown } from '@/hooks/useWaitlist'

const COLORS = ['#1F6F5F', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#6B7280']

export function UtmSourceChart() {
  const { data, error, isLoading } = useUtmBreakdown()

  const chartData = (data?.rows ?? []).map((row) => ({
    source: row.utm_source ?? 'Direct',
    count: row.count,
  }))

  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Traffic Sources
      </h2>

      {error && <p className="text-sm text-red-600">Couldn't load traffic sources.</p>}
      {isLoading && !data && <div className="h-56 animate-pulse rounded bg-gray-100" />}
      {data && chartData.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">No UTM data recorded yet.</p>
      )}

      {data && chartData.length > 0 && (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="source"
                tick={{ fontSize: 12, fill: '#374151' }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}