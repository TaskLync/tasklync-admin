'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BannerStats } from '@/types/banner'

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

/** Counts are unique customers per day (a customer seeing a banner ten times in a day counts once). */
export default function BannerStatsPanel({ stats }: { stats: BannerStats }) {
  const fmt = (n: number) => n.toLocaleString('en-PK')
  const daily = stats.daily.map((d) => ({
    ...d,
    label: new Date(`${d.day}T00:00:00+05:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Karachi' }),
    ctr: d.impressions ? Math.round((d.clicks / d.impressions) * 1000) / 10 : 0,
  }))

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Performance</h2>
        <p className="text-xs text-gray-400">Unique customers per day, Pakistan time</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Impressions" value={fmt(stats.impressions)} />
        <Tile label="Clicks" value={fmt(stats.clicks + stats.ctaClicks)} hint={`${fmt(stats.ctaClicks)} on the button`} />
        <Tile label="Click-through rate" value={`${stats.ctr.toFixed(2)}%`} />
        <Tile label="Customers reached" value={fmt(stats.uniqueUsers)} />
      </div>

      {daily.length > 0 ? (
        <div className="mt-4 h-44" role="img" aria-label="Daily impressions, last 30 days">
          <p className="mb-1 text-xs font-medium text-gray-600">Daily impressions (last 30 days)</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} minTickGap={16} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip
                cursor={{ fill: 'rgba(31,111,95,0.06)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof daily)[number]
                  return (
                    <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                      <p className="font-medium text-gray-900">{d.label}</p>
                      <p className="text-gray-600">{fmt(d.impressions)} impressions</p>
                      <p className="text-gray-600">{fmt(d.clicks)} clicks · {d.ctr}% CTR</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="impressions" fill="#1F6F5F" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
          No impressions yet. Numbers appear once the banner is live and customers open the home screen.
        </p>
      )}
    </section>
  )
}
