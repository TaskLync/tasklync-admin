// components/workers/WorkerReviewHistory.tsx
'use client'

import { Card } from '@/components/ui/Card'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { useWorkerReviews } from '@/hooks/useWorkers'
import { formatDate } from './worker-ui'
import type { WorkerReviewRow } from '@/types/worker'

const columns: DataTableColumn<WorkerReviewRow>[] = [
  { key: 'customer', header: 'Customer', render: (r) => r.customerName ?? '—' },
  { key: 'rating', header: 'Rating', render: (r) => '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) },
  { key: 'comment', header: 'Comment', render: (r) => r.comment ?? '—', className: 'max-w-xs truncate' },
  { key: 'date', header: 'Date', render: (r) => formatDate(r.createdAt) },
]

export default function WorkerReviewHistory({ workerId }: { workerId: string }) {
  const { reviews, available, isLoading, error, mutate } = useWorkerReviews(workerId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Reviews Received</h2>
      {!available ? (
        <p className="text-sm text-gray-500">Review history isn't wired up yet — pending the Reviews page schema.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={reviews}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={() => mutate()}
          emptyMessage="This worker hasn't received any reviews."
        />
      )}
    </Card>
  )
}