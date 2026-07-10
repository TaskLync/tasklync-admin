'use client'

import { useDashboardKpis } from '@/hooks/useDashboard'
import { KpiCard, KpiCardSkeleton } from './KpiCard'
import { Card } from '@/components/ui/Card'

function pctChange(today: number, yesterday: number): number | null {
  if (yesterday === 0) return today === 0 ? 0 : 100
  return ((today - yesterday) / yesterday) * 100
}

function formatPkr(n: number) {
  return `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
}

function sparkArray(points: { day_total: number }[] | undefined) {
  return (points ?? []).map((p) => p.day_total)
}

export function KpiGrid() {
  const { data, error, isLoading } = useDashboardKpis()

  if (error) {
    return (
      <Card className="p-4 text-sm text-red-600">
        Couldn't load KPI metrics.{' '}
        <button className="underline" onClick={() => window.location.reload()}>
          Retry
        </button>
      </Card>
    )
  }

  if (isLoading || !data) {
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
        label="Total Revenue Today"
        value={formatPkr(data.revenueToday)}
        changePct={pctChange(data.revenueToday, data.revenueYesterday)}
        sparkline={sparkArray(data.revenueSparkline)}
        color="#1F6F5F"
      />
      <KpiCard
        label="Active Bookings Now"
        value={data.activeBookingsNow.toString()}
        changePct={null}
        sparkline={sparkArray(data.activeBookingsSparkline)}
        color="#2563EB"
      />
      <KpiCard
        label="New Signups Today"
        value={data.newSignupsToday.toString()}
        changePct={pctChange(data.newSignupsToday, data.newSignupsYesterday)}
        sparkline={sparkArray(data.signupsSparkline)}
        color="#D97706"
      />
      <KpiCard
        label="Pending Verifications"
        value={data.pendingVerifications.toString()}
        changePct={null}
        sparkline={sparkArray(data.pendingVerificationsSparkline)}
        color="#DC2626"
      />
    </div>
  )
}