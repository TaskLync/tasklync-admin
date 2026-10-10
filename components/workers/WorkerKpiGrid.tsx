// components/workers/WorkerKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { useWorkerKpis } from '@/hooks/useWorkers'

export function WorkerKpiGrid() {
  const { kpis, error, isLoading, mutate } = useWorkerKpis()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load worker stats.{' '}
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
      <KpiCard
        label="Total Workers"
        value={kpis.totalWorkers.toLocaleString('en-PK')}
        color="#1F6F5F"
      />
      <KpiCard
        label="Signups Today"
        value={kpis.signupsToday.toString()}
        changePct={kpis.signupsTodayChangePct}
        sparkline={kpis.signupsSparkline7d}
        color="#2563EB"
      />
      <KpiCard
        label="Online Now"
        value={kpis.onlineNow.toLocaleString('en-PK')}
        color="#D97706"
      />
      <KpiCard
        label="Suspended / Banned"
        value={kpis.suspendedOrBanned.toLocaleString('en-PK')}
        color="#DC2626"
      />
    </div>
  )
}