// components/reviews/ReviewTable.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import type { ReviewListTab } from '@/lib/review-constants'
import type { ReviewListItem } from '@/types/review'
import {
  MODERATION_LABEL,
  MODERATION_TONE,
  Person,
  REASON_LABEL,
  SIGNAL_HINT,
  SIGNAL_LABEL,
  Stars,
  formatDateTime,
  shortId,
} from './review-ui'

interface Props {
  tab: ReviewListTab
  rows: ReviewListItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

const EMPTY: Record<ReviewListTab, string> = {
  flagged: 'No reviews waiting for moderation. Nice work.',
  all: 'No reviews match these filters.',
}

export default function ReviewTable({ tab, rows, isLoading, error, onRetry }: Props) {
  const router = useRouter()
  const isFlagged = tab === 'flagged'

  const columns: DataTableColumn<ReviewListItem>[] = [
    {
      key: 'review',
      header: 'Review',
      render: (r) => (
        <div className="max-w-[260px] leading-tight">
          <span className="block truncate text-gray-800">
            {r.comment?.trim() ? r.comment : <span className="text-gray-400">No written comment</span>}
          </span>
          <span className="font-mono text-[11px] text-gray-400">{shortId(r.id)}</span>
          {r.photoCount > 0 && (
            <span className="ml-2 text-[11px] text-gray-400">{r.photoCount} photo(s)</span>
          )}
        </div>
      ),
    },
    { key: 'rating', header: 'Rating', render: (r) => <Stars rating={r.rating} /> },
    {
      key: 'author',
      header: 'Author',
      render: (r) => <Person name={r.userName} phone={r.userPhone} />,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (r) => <Person name={r.workerName} phone={r.workerPhone} />,
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (r) => (
        <Link
          href={`/bookings/${r.bookingId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-gray-700 hover:text-[#1F6F5F] hover:underline"
        >
          {shortId(r.bookingId)}
        </Link>
      ),
    },
    ...(isFlagged
      ? [
          {
            key: 'flag',
            header: 'Flag reason',
            render: (r: ReviewListItem) => (
              <div className="flex flex-wrap items-center gap-1">
                {r.latestReportReason ? (
                  <Badge tone="warning">{REASON_LABEL[r.latestReportReason]}</Badge>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                <span className="text-[11px] text-gray-400">
                  {r.openReportCount} open · {r.reportCount} total
                </span>
              </div>
            ),
          } satisfies DataTableColumn<ReviewListItem>,
        ]
      : [
          {
            key: 'signals',
            header: 'Signals',
            render: (r: ReviewListItem) =>
              r.signals.length === 0 ? (
                <span className="text-gray-400">—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {r.signals.map((s) => (
                    <span key={s} title={SIGNAL_HINT[s]}>
                      <Badge tone="warning">{SIGNAL_LABEL[s]}</Badge>
                    </span>
                  ))}
                </div>
              ),
          } satisfies DataTableColumn<ReviewListItem>,
        ]),
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={MODERATION_TONE[r.moderationStatus]}>
          {MODERATION_LABEL[r.moderationStatus]}
        </Badge>
      ),
    },
    { key: 'submitted', header: 'Submitted', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      render: (r) => (
        <Link
          href={`/reviews/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className={
            isFlagged
              ? 'inline-flex h-8 items-center rounded-md bg-[#1F6F5F] px-2.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#195c4f]'
              : 'inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50'
          }
        >
          {isFlagged ? 'Review' : 'View'}
        </Link>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyMessage={EMPTY[tab]}
      onRowClick={(r) => router.push(`/reviews/${r.id}`)}
      // Auto-hidden = already off the public page and waiting on a human. DataTable rows use
      // even:bg-gray-50, so the highlight needs important (`!` suffix, Tailwind v4).
      rowClassName={(r) =>
        r.moderationStatus === 'AUTO_HIDDEN' ? 'bg-amber-50! even:bg-amber-50! hover:bg-amber-100!' : ''
      }
    />
  )
}