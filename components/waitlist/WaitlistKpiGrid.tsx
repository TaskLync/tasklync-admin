'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { useWaitlistKpis } from '@/hooks/useWaitlist'

export function WaitlistKpiGrid() {
  const { data, error, isLoading } = useWaitlistKpis()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load waitlist stats. <span className="underline cursor-pointer">Retry</span>
      </div>
    )
  }

  if (isLoading) {
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
        label="Total Signups"
        value={data?.total_signups?.toString() ?? '—'}
        sparkline={data?.sparkline_7d ?? []}
        color="#1F6F5F"
      />
      <KpiCard
        label="Signups Today"
        value={data?.signups_today?.toString() ?? '—'}
        changePct={data?.signups_today_change_pct ?? null}
        color="#2563EB"
      />
      <KpiCard
        label="Signups This Week"
        value={data?.signups_this_week?.toString() ?? '—'}
        changePct={data?.signups_this_week_change_pct ?? null}
        color="#D97706"
      />
      <KpiCard
        label="Conversion Rate"
        value={data ? `${data.conversion_rate}%` : '—'}
        color="#DC2626"
      />
    </div>
  )
}