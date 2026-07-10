// components/users/UserReviewHistory.tsx
'use client'

import { Card } from '@/components/ui/Card'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { useUserReviews } from '@/hooks/useUsers'
import type { UserReviewRow } from '@/types/user'

const columns: DataTableColumn<UserReviewRow>[] = [
  { key: 'worker', header: 'Worker', render: (r) => r.workerName ?? '—' },
  { key: 'rating', header: 'Rating', render: (r) => '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) },
  { key: 'comment', header: 'Comment', render: (r) => r.comment ?? '—', className: 'max-w-xs truncate' },
  {
    key: 'date', header: 'Date',
    render: (r) => new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  },
]

export default function UserReviewHistory({ userId }: { userId: string }) {
  const { reviews, available, isLoading, error, mutate } = useUserReviews(userId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Reviews Written</h2>
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
          emptyMessage="This user hasn't written any reviews."
        />
      )}
    </Card>
  )
}