// components/analytics/CategoryPerformance.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable'
import { useAnalyticsCategories } from '@/hooks/useAnalytics'
import type { AnalyticsRange, CategoryPerformanceRow } from '@/types/analytics'
import { formatPkr } from './analytics-ui'

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

export default function CategoryPerformance({ days }: { days: AnalyticsRange }) {
  const { categories, isLoading, error, mutate } = useAnalyticsCategories(days)

  const columns: DataTableColumn<CategoryPerformanceRow>[] = [
    {
      key: 'category',
      header: 'Category',
      render: (c) => <span className="font-medium text-gray-900">{c.categoryName}</span>,
    },
    { key: 'bookings', header: 'Bookings', render: (c) => c.bookings.toLocaleString() },
    { key: 'completion', header: 'Completion rate', render: (c) => pct(c.completionRate) },
    {
      key: 'cancellation',
      header: 'Cancellation rate',
      render: (c) => (
        <span className={c.cancellationRate !== null && c.cancellationRate >= 30 ? 'font-medium text-[#DC2626]' : ''}>
          {pct(c.cancellationRate)}
        </span>
      ),
    },
    {
      key: 'avg',
      header: 'Avg value',
      render: (c) => (c.avgValue === null ? '—' : formatPkr(Math.round(c.avgValue))),
    },
    {
      key: 'rating',
      header: 'Avg worker rating',
      render: (c) => (c.avgWorkerRating === null ? '—' : c.avgWorkerRating.toFixed(1)),
    },
    {
      key: 'top',
      header: 'Top worker',
      render: (c) =>
        c.topWorker ? (
          <Link href={`/workers/${c.topWorker.id}`} className="hover:text-[#1F6F5F] hover:underline">
            {c.topWorker.name ?? 'Unknown'}{' '}
            <span className="text-xs text-gray-400">({c.topWorker.jobs} jobs)</span>
          </Link>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Category performance</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Bookings created in the last {days} days. Completion and cancellation rates are measured against
          closed bookings only (open ones are ignored). Worker rating is the average of the category’s workers.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={categories?.data ?? []}
        rowKey={(c) => c.categoryId}
        isLoading={isLoading && !categories}
        error={error && !categories ? error : undefined}
        onRetry={() => mutate()}
        emptyMessage="No categories yet."
      />
    </Card>
  )
}