'use client'

import { Card } from '@/components/ui/Card'
import { pct } from '@/components/ranking/explain-ui'
import { formatDateTime } from '@/components/bookings/booking-ui'
import type { RankingExplain } from '@/types/ranking'

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-gray-100 p-3" title={hint}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

export default function ExplainPerformance({ e }: { e: RankingExplain }) {
  const p = e.performance
  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Worker performance behind the terms</h2>
      <p className="mb-3 text-xs text-gray-500">Recent jobs count more than old ones (45-day half-life). Numbers are what the search index holds right now.</p>
      {!p.hasData ? (
        <p className="text-sm text-gray-500">No performance row yet. Reliability, cancellation and satisfaction use neutral defaults until the hourly rollup runs.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Acceptance" value={pct(p.acceptanceRate)} hint="accepted / (accepted + rejected + expired)" />
            <Tile label="Completion" value={pct(p.completionRate)} hint="completed / (completed + worker cancel + no-show)" />
            <Tile label="Worker cancel + no-show" value={pct(p.cancelNoShowRate)} />
            <Tile label="4+ star share" value={pct(p.highRatingShare)} />
            <Tile label="Jobs done" value={String(p.jobsDone)} />
            <Tile label="Repeat customers" value={pct(p.repeatRate)} />
            <Tile label="Flag multiplier" value={`x${p.rankingMultiplier.toFixed(2)}`} />
            <Tile label="Avg response" value={`${e.worker.responseTimeMins} min`} />
          </div>
          <p className="mt-2 text-xs text-gray-400">Stats computed {p.updatedAt ? formatDateTime(p.updatedAt) : 'never'}.</p>
        </>
      )}
    </Card>
  )
}