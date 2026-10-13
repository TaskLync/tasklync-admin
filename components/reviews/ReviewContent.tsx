// components/reviews/ReviewContent.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import type { ReviewDetail } from '@/types/review'
import { Stars, formatDateTime, formatPkr, prettify, shortId } from './review-ui'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{children}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h3>
  )
}

export default function ReviewContent({ review }: { review: ReviewDetail }) {
  const b = review.booking

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Review</h2>

      <div className="flex items-center gap-2">
        <Stars rating={review.rating} className="text-lg" />
        <span className="text-sm font-medium text-gray-900">{review.rating}.0</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-800">
        {review.comment?.trim() ? (
          review.comment
        ) : (
          <span className="text-gray-400">The customer left a rating without a written comment.</span>
        )}
      </p>

      {review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.map((t) => (
            <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {prettify(t)}
            </span>
          ))}
        </div>
      )}

      {review.photoUrls.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {review.photoUrls.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <Image
                src={url}
                alt={`Review photo ${i + 1}`}
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-md object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-gray-400">
        Posted {formatDateTime(review.createdAt)}
        {review.editedAt && ` · edited ${formatDateTime(review.editedAt)}`}
      </p>

      {review.workerReply && (
        <div className="mt-4 rounded-md bg-gray-50 px-3 py-2">
          <SectionTitle>Worker reply</SectionTitle>
          <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{review.workerReply}</p>
          <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(review.workerRepliedAt)}</p>
        </div>
      )}

      <div className="mt-5 border-t border-gray-100 pt-4">
        <SectionTitle>Booking</SectionTitle>
        <Row label="Booking">
          <Link href={`/bookings/${b.id}`} className="font-mono text-xs hover:text-[#1F6F5F] hover:underline">
            {shortId(b.id)}
          </Link>
        </Row>
        <Row label="Status">{b.status ? b.status.replace(/_/g, ' ').toLowerCase() : '—'}</Row>
        <Row label="Scheduled">{formatDateTime(b.scheduledAt)}</Row>
        <Row label="Completed">{formatDateTime(b.completedAt)}</Row>
        <Row label="Amount">
          {b.estimatedTotal === null ? '—' : formatPkr(b.estimatedTotal, b.currency)}
        </Row>
      </div>

      {review.moderatedAt && (
        <div className="mt-4 rounded-md bg-gray-50 px-3 py-2">
          <SectionTitle>Last moderation decision</SectionTitle>
          <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
            {review.moderationNote ?? 'No reason recorded.'}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">
            {review.moderatedByName ?? 'Admin'} · {formatDateTime(review.moderatedAt)}
          </p>
        </div>
      )}
    </Card>
  )
}