// components/reviews/ReviewKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { Card } from '@/components/ui/Card'
import { useReviewCounts } from '@/hooks/useReviews'

export function ReviewKpiGrid() {
  const { counts, error, isLoading, mutate } = useReviewCounts()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load review stats.{' '}
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
        <KpiCard label="Awaiting moderation" value={counts.flagged.toLocaleString('en-PK')} color="#DC2626" />
        <KpiCard label="Auto-hidden" value={counts.autoHidden.toLocaleString('en-PK')} color="#D97706" />
        <KpiCard
          label="Reviews (30 days)"
          value={counts.last30d.toLocaleString('en-PK')}
          sparkline={counts.sparkline7d}
          color="#2563EB"
        />
        <KpiCard
          label="Average rating (30 days)"
          value={counts.avgRating30d === null ? '—' : counts.avgRating30d.toFixed(2)}
          color="#1F6F5F"
        />
      </div>
      <Card className="flex flex-wrap gap-x-8 gap-y-2 px-4 py-3 text-sm text-gray-600">
        <span>
          Total reviews: <strong className="text-gray-900">{counts.total.toLocaleString('en-PK')}</strong>
        </span>
        <span>
          Hidden by an admin:{' '}
          <strong className="text-gray-900">{counts.adminHidden.toLocaleString('en-PK')}</strong>
        </span>
        <span className="text-xs text-gray-400">
          Average counts publicly visible reviews only (visible + restored).
        </span>
      </Card>
    </div>
  )
}