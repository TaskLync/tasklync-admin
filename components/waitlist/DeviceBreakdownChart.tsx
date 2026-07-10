// components/waitlist/DeviceBreakdownChart.tsx
'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Card } from '@/components/ui/Card'
import { useDeviceBreakdown } from '@/hooks/useWaitlist'
import type { DeviceBreakdownRow } from '@/types/waitlist'

const COLORS = ['#1F6F5F', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#6B7280']

function MiniDonut({ title, data }: { title: string; data: DeviceBreakdownRow[] }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <p className="text-xs font-medium text-gray-500">{title}</p>
      {data.length === 0 ? (
        <p className="py-10 text-xs text-gray-400">No data yet</p>
      ) : (
        <>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={2}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            {data.slice(0, 4).map((d, i) => (
              <li key={d.label} className="flex items-center gap-1 text-xs text-gray-600">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                {d.label} ({d.pct}%)
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function DeviceBreakdownChart() {
  const { data, error, isLoading } = useDeviceBreakdown()

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Device &amp; Browser Breakdown
        </h2>
        {data && (
          <span className="text-xs text-gray-400">Based on {data.sampledFrom.toLocaleString()} entries</span>
        )}
      </div>

      {error && <p className="text-sm text-red-600">Couldn't load device breakdown.</p>}
      {isLoading && !data && <div className="h-48 animate-pulse rounded bg-gray-100" />}

      {data && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <MiniDonut title="Device Type" data={data.device} />
          <MiniDonut title="Browser" data={data.browser} />
          <MiniDonut title="Operating System" data={data.os} />
        </div>
      )}
    </Card>
  )
}