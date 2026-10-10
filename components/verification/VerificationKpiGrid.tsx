// components/verification/VerificationKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { useVerificationCounts } from '@/hooks/useVerification'

export function VerificationKpiGrid() {
  const { counts, error, isLoading, mutate } = useVerificationCounts()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load verification stats.{' '}
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Awaiting review"
        value={(counts.pending + counts.resubmitted).toLocaleString('en-PK')}
        color="#1F6F5F"
      />
      <KpiCard
        label="Waiting over 48h"
        value={counts.overdue48h.toLocaleString('en-PK')}
        color="#D97706"
      />
      <KpiCard
        label="Approved (30 days)"
        value={counts.approved.toLocaleString('en-PK')}
        color="#16A34A"
      />
      <KpiCard
        label="Rejected (30 days)"
        value={counts.rejected.toLocaleString('en-PK')}
        color="#DC2626"
      />
    </div>
  )
}