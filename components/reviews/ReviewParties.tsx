// components/reviews/ReviewParties.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import type { ReviewDetail } from '@/types/review'
import { initial } from './review-ui'

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={40}
      height={40}
      unoptimized
      className="h-10 w-10 rounded-full object-cover"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm text-gray-500">
      {initial(name)}
    </div>
  )
}

export default function ReviewParties({ review }: { review: ReviewDetail }) {
  const { reviewer, worker } = review

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Parties</h2>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Avatar url={reviewer.avatarUrl} name={reviewer.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-400">Reviewer (customer)</p>
            {reviewer.id ? (
              <Link
                href={`/users/${reviewer.id}`}
                className="font-medium text-gray-900 hover:text-[#1F6F5F] hover:underline"
              >
                {reviewer.name ?? 'Unnamed'}
              </Link>
            ) : (
              <p className="font-medium text-gray-900">{reviewer.name ?? 'Unknown'}</p>
            )}
            <p className="font-mono text-xs text-gray-500">{reviewer.phone ?? '—'}</p>
            <p className="mt-1 text-xs text-gray-400">
              {reviewer.reviewsWritten} reviews written
              {reviewer.avgGiven !== null && ` · gives ${reviewer.avgGiven.toFixed(1)}★ on average`}
            </p>
            <p
              className={
                reviewer.oneStar30d >= 3 || reviewer.warningCount > 0
                  ? 'text-xs text-[#DC2626]'
                  : 'text-xs text-gray-400'
              }
            >
              {reviewer.oneStar30d} one-star in 30 days · {reviewer.warningCount} warning(s)
            </p>
            {reviewer.id && (
              <Link
                href={`/reviews?userId=${reviewer.id}`}
                className="mt-1 inline-block text-xs text-[#1F6F5F] hover:underline"
              >
                All reviews by this customer
              </Link>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100" />

        <div className="flex items-start gap-3">
          <Avatar url={worker.avatarUrl} name={worker.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-400">Worker (reviewed)</p>
            {worker.id ? (
              <Link
                href={`/workers/${worker.id}`}
                className="font-medium text-gray-900 hover:text-[#1F6F5F] hover:underline"
              >
                {worker.name ?? 'Unnamed'}
              </Link>
            ) : (
              <p className="font-medium text-gray-900">{worker.name ?? 'Unknown'}</p>
            )}
            <p className="font-mono text-xs text-gray-500">{worker.phone ?? '—'}</p>
            <p className="mt-1 text-xs text-gray-400">
              {worker.totalReviews > 0
                ? `★ ${worker.avgRating.toFixed(1)} (${worker.totalReviews} reviews)`
                : 'No reviews yet'}
              {worker.city && ` · ${worker.city}`}
            </p>
            {worker.id && (
              <Link
                href={`/reviews?workerId=${worker.id}`}
                className="mt-1 inline-block text-xs text-[#1F6F5F] hover:underline"
              >
                All reviews for this worker
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}