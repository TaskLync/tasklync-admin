// components/workers/WorkerReviewHistory.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { MODERATION_LABEL, MODERATION_TONE } from '@/components/reviews/review-ui'
import { useWorkerReviews } from '@/hooks/useWorkers'
import type { ModerationStatus } from '@/lib/review-constants'
import { formatDate } from './worker-ui'
import type { WorkerReviewRow } from '@/types/worker'

type Row = WorkerReviewRow & { moderationStatus?: ModerationStatus }

const columns: DataTableColumn<Row>[] = [
  { key: 'customer', header: 'Customer', render: (r) => r.customerName ?? '—' },
  { key: 'rating', header: 'Rating', render: (r) => '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) },
  { key: 'comment', header: 'Comment', render: (r) => r.comment ?? '—', className: 'max-w-xs truncate' },
  {
    key: 'status',
    header: 'Status',
    render: (r) =>
      r.moderationStatus && r.moderationStatus !== 'VISIBLE' ? (
        <Badge tone={MODERATION_TONE[r.moderationStatus]}>{MODERATION_LABEL[r.moderationStatus]}</Badge>
      ) : (
        '—'
      ),
  },
  { key: 'date', header: 'Date', render: (r) => formatDate(r.createdAt) },
  {
    key: 'open',
    header: '',
    className: 'text-right',
    render: (r) => (
      <Link href={`/reviews/${r.id}`} className="text-xs font-medium text-[#1F6F5F] hover:underline">
        View
      </Link>
    ),
  },
]

export default function WorkerReviewHistory({ workerId }: { workerId: string }) {
  const { reviews, available, isLoading, error, mutate } = useWorkerReviews(workerId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Reviews Received</h2>
      {!available ? (
        <p className="text-sm text-gray-500">Review history isn't available yet. The reviews tables aren't reachable.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={reviews as Row[]}
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