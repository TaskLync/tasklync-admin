// app/(admin)/reviews/[reviewId]/page.tsx
'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { useReviewDetail } from '@/hooks/useReviews'
import ReviewHeader from '@/components/reviews/ReviewHeader'
import ReviewContent from '@/components/reviews/ReviewContent'
import ReviewReports from '@/components/reviews/ReviewReports'
import ReviewModerationPanel from '@/components/reviews/ReviewModerationPanel'
import ReviewParties from '@/components/reviews/ReviewParties'
import ReviewNotes from '@/components/reviews/ReviewNotes'
import ReviewActivity from '@/components/reviews/ReviewActivity'

export default function ReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>
}) {
  const { reviewId } = use(params)
  const { review, isLoading, error, mutate } = useReviewDetail(reviewId)
  const { mutate: globalMutate } = useSWRConfig()

  // After any action: reload this review, the queue + counts, and the worker/user history lists.
  function refreshAll() {
    mutate()
    globalMutate(
      (key) =>
        typeof key === 'string' &&
        (key.startsWith('/api/admin/reviews') ||
          key.startsWith('/api/admin/dashboard/attention') ||
          (review?.worker.id ? key.startsWith(`/api/admin/workers/${review.worker.id}`) : false) ||
          (review?.reviewer.id ? key.startsWith(`/api/admin/users/${review.reviewer.id}`) : false))
    )
  }

  return (
    <div className="px-6 py-5">
      <Link
        href="/reviews"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to Reviews
      </Link>

      <ReviewHeader review={review} isLoading={isLoading} error={error} />

      {error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
          {error.message === 'Review not found' ? (
            "This review doesn't exist."
          ) : (
            <>
              Couldn't load this review.{' '}
              <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {review && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <ReviewContent review={review} />
            <ReviewReports reports={review.reports} />
          </div>
          <div className="flex flex-col gap-4">
            <ReviewModerationPanel review={review} onChanged={refreshAll} />
            <ReviewParties review={review} />
            <ReviewNotes reviewId={review.id} />
            <ReviewActivity activity={review.activity} />
          </div>
        </div>
      )}
    </div>
  )
}