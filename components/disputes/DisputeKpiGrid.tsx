// components/disputes/DisputeKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { Card } from '@/components/ui/Card'
import { useDisputeCounts } from '@/hooks/useDisputes'
import { formatPkr } from './dispute-ui'

export function DisputeKpiGrid() {
  const { counts, error, isLoading, mutate } = useDisputeCounts()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load dispute stats.{' '}
        <button onClick={() => mutate()} className="underline">
          Retry
        </button>
      </div>
    )
  }

  if (isLoading || !counts) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Needs a decision" value={counts.open.toLocaleString('en-PK')} color="#DC2626" />
        <KpiCard label="Awaiting response" value={counts.awaiting.toLocaleString('en-PK')} color="#D97706" />
        <KpiCard label="Escalated" value={counts.escalated.toLocaleString('en-PK')} color="#7C3AED" />
        <KpiCard label="Resolved (30 days)" value={counts.resolved.toLocaleString('en-PK')} color="#16A34A" />
      </div>
      <Card className="flex flex-wrap gap-x-8 gap-y-2 px-4 py-3 text-sm text-gray-600">
        <span>
          Open over 48h: <strong className="text-gray-900">{counts.overdue48h}</strong>
        </span>
        <span>
          Open over 72h: <strong className="text-gray-900">{counts.overdue72h}</strong>
        </span>
        <span>
          Refunded through disputes (30 days):{' '}
          <strong className="text-gray-900">{formatPkr(counts.refundedAmount30d)}</strong>
        </span>
      </Card>
    </div>
  )
}