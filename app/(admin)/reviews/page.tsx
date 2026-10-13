// app/(admin)/reviews/page.tsx
import { Suspense } from 'react'
import ReviewsSection from '@/components/reviews/ReviewsSection'
import { ReviewKpiGrid } from '@/components/reviews/ReviewKpiGrid'

export const metadata = { title: 'Reviews & Ratings | Tasklync Admin' }

export default function ReviewsPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Reviews &amp; Ratings</h1>
        <p className="text-sm text-gray-500">
          Moderate reported reviews, remove abusive ones with a logged reason, and keep an eye on
          workers whose ratings are slipping.
        </p>
      </div>
      <div className="mb-4">
        <ReviewKpiGrid />
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <ReviewsSection />
      </Suspense>
    </div>
  )
}