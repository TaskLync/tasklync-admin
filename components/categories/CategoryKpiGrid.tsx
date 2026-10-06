'use client'

import { KpiCard, KpiCardSkeleton } from '@/components/dashboard/KpiCard'
import { useCategoryKpis } from '@/hooks/useCategories'

export function CategoryKpiGrid() {
  const { kpis, error, isLoading } = useCategoryKpis()

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Couldn't load category stats. <span className="underline cursor-pointer">Retry</span>
      </div>
    )
  }

  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total Categories" value={kpis.totalCategories.toString()} color="#1F6F5F" />
      <KpiCard label="Active Categories" value={kpis.activeCategories.toString()} color="#2563EB" />
      <KpiCard label="Total Services" value={kpis.totalServices.toString()} color="#D97706" />
      <KpiCard
        label="Categories With No Active Workers"
        value={kpis.categoriesWithNoActiveWorkers.toString()}
        color="#DC2626"
      />
    </div>
  )
}