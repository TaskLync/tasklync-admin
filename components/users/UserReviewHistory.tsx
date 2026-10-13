// components/users/UserReviewHistory.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { MODERATION_LABEL, MODERATION_TONE } from '@/components/reviews/review-ui'
import { useUserReviews } from '@/hooks/useUsers'
import type { ModerationStatus } from '@/lib/review-constants'
import type { UserReviewRow } from '@/types/user'

type Row = UserReviewRow & { moderationStatus?: ModerationStatus }

const columns: DataTableColumn<Row>[] = [
  { key: 'worker', header: 'Worker', render: (r) => r.workerName ?? '—' },
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
  {
    key: 'date', header: 'Date',
    render: (r) => new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  },
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

export default function UserReviewHistory({ userId }: { userId: string }) {
  const { reviews, available, isLoading, error, mutate } = useUserReviews(userId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Reviews Written</h2>
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
          emptyMessage="This user hasn't written any reviews."
        />
      )}
    </Card>
  )
}