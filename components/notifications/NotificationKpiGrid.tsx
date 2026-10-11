// components/notifications/NotificationKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { useNotificationKpis } from '@/hooks/useNotifications'

export function NotificationKpiGrid() {
  const { kpis, error, isLoading, mutate } = useNotificationKpis()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load notification stats. {(error as Error).message}{' '}
        <button onClick={() => mutate()} className="underline">
          Retry
        </button>
      </div>
    )
  }

  if (isLoading || !kpis) {
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
      <KpiCard label="Broadcasts (30 days)" value={kpis.campaigns30d.toLocaleString('en-PK')} color="#1F6F5F" />
      <KpiCard label="Recipients (30 days)" value={kpis.recipients30d.toLocaleString('en-PK')} color="#2563EB" />
      <KpiCard
        label="Delivery rate"
        value={kpis.deliveryRate30d === null ? '—' : `${kpis.deliveryRate30d}%`}
        color="#D97706"
      />
      <KpiCard
        label="Needs attention"
        value={(kpis.sending + kpis.failed30d).toLocaleString('en-PK')}
        color="#DC2626"
      />
    </div>
  )
}