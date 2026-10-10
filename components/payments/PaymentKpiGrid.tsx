// components/payments/PaymentKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import type { OverviewPeriod, PaymentOverview } from '@/types/payment'
import { formatPkr } from './payment-ui'

interface Props {
  data: PaymentOverview | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
  period: OverviewPeriod
}

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5'

export function PaymentKpiGrid({ data, isLoading, error, onRetry, period }: Props) {
  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load payment stats.{' '}
        <button onClick={onRetry} className="underline">
          Retry
        </button>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className={GRID}>
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  const tag = period === 'ytd' ? 'YTD' : 'MTD'

  return (
    <div className={GRID}>
      <KpiCard
        label={`Gross revenue (${tag})`}
        value={formatPkr(data.grossRevenue, data.currency)}
        sparkline={data.grossSparkline7d}
        color="#1F6F5F"
      />
      <KpiCard
        label={`Platform fees (${tag})`}
        value={formatPkr(data.platformFees, data.currency)}
        sparkline={data.feesSparkline7d}
        color="#2563EB"
      />
      <KpiCard
        label={`Worker payouts paid (${tag})`}
        value={formatPkr(data.workerPayoutsPaid, data.currency)}
        color="#D97706"
      />
      <KpiCard
        label={`Pending escrow (${data.escrowCount})`}
        value={formatPkr(data.escrowHeld, data.currency)}
        color="#7C3AED"
      />
      <KpiCard
        label={`Refunds issued (${tag})`}
        value={formatPkr(data.refundsIssued, data.currency)}
        color="#DC2626"
      />
    </div>
  )
}