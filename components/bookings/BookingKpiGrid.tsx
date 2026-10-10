// components/bookings/BookingKpiGrid.tsx
'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { useBookingKpis } from '@/hooks/useBookings'

export function BookingKpiGrid() {
  const { kpis, error, isLoading, mutate } = useBookingKpis()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load booking stats.{' '}
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
        label="Bookings Today"
        value={kpis.bookingsToday.toLocaleString('en-PK')}
        changePct={kpis.bookingsTodayChangePct}
        sparkline={kpis.createdSparkline7d}
        color="#1F6F5F"
      />
      <KpiCard
        label="Pending Now"
        value={kpis.pendingNow.toLocaleString('en-PK')}
        color="#D97706"
      />
      <KpiCard
        label="In Progress"
        value={kpis.inProgressNow.toLocaleString('en-PK')}
        color="#2563EB"
      />
      <KpiCard
        label="Disputed"
        value={kpis.disputedNow.toLocaleString('en-PK')}
        color="#DC2626"
      />
    </div>
  )
}