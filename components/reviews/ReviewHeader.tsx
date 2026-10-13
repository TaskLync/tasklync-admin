// components/reviews/ReviewHeader.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { isPubliclyVisible } from '@/lib/review-constants'
import type { ReviewDetail } from '@/types/review'
import {
  MODERATION_LABEL,
  MODERATION_TONE,
  SIGNAL_HINT,
  SIGNAL_LABEL,
  Stars,
  formatDate,
  shortId,
} from './review-ui'

function HeaderSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-52 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-end gap-2">
              <div className="h-6 w-16 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-14 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

interface Props {
  review?: ReviewDetail
  isLoading?: boolean
  error?: unknown
}

export default function ReviewHeader({ review, isLoading, error }: Props) {
  if (error) return null
  if (isLoading || !review) return <HeaderSkeleton />

  const b = review.booking

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-gray-900">{shortId(review.id)}</h1>
            <Badge tone={MODERATION_TONE[review.moderationStatus]}>
              {MODERATION_LABEL[review.moderationStatus]}
            </Badge>
            {review.openReportCount > 0 && (
              <Badge tone="danger">
                {review.openReportCount} open report{review.openReportCount === 1 ? '' : 's'}
              </Badge>
            )}
            {review.signals.map((s) => (
              <span key={s} title={SIGNAL_HINT[s]}>
                <Badge tone="warning">{SIGNAL_LABEL[s]}</Badge>
              </span>
            ))}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {b.categoryName ?? b.categoryId ?? 'Unknown category'}
            {' · Booking '}
            <Link
              href={`/bookings/${b.id}`}
              className="font-mono text-gray-700 hover:text-[#1F6F5F] hover:underline"
            >
              {shortId(b.id)}
            </Link>
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-gray-400">{review.id}</p>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="flex justify-end text-2xl">
              <Stars rating={review.rating} className="text-xl" />
            </p>
            <p className="text-xs text-gray-400">{review.rating} out of 5</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{review.reportCount}</p>
            <p className="text-xs text-gray-400">Reports</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{formatDate(review.createdAt)}</p>
            <p className="text-xs text-gray-400">Posted</p>
          </div>
        </div>
      </div>

      {!isPubliclyVisible(review.moderationStatus) && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This review is hidden from the public worker profile and doesn't count toward the public
          rating summary.
        </p>
      )}
    </Card>
  )
}