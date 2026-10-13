// components/reviews/ReviewsSection.tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'
import {
  REVIEW_TABS,
  type ReviewListTab,
  type ReviewTab,
} from '@/lib/review-constants'
import { useReviewCounts, useReviewFilters, useReviewList } from '@/hooks/useReviews'
import { useWorkerFilterOptions } from '@/hooks/useWorkers'
import RatingAuditTab from './RatingAuditTab'
import ReviewFilterBar from './ReviewFilterBar'
import ReviewTable from './ReviewTable'
import { KNOWN_CITIES, Pager } from './review-ui'

const TAB_LABEL: Record<ReviewTab, string> = {
  flagged: 'Flagged',
  all: 'All reviews',
  audit: 'Rating audit',
}

const TAB_HINT: Record<ReviewTab, string> = {
  flagged:
    'Reviews with open reports. Auto-hidden ones come first. Keep a review to dismiss the reports, or hide it with a reason.',
  all: 'Every review on the platform. Open one to hide or restore it.',
  audit: 'Workers whose rating is low, dropping fast, or who have many disputes.',
}

function ReviewQueue({
  listTab,
  initialWorkerId,
  initialUserId,
}: {
  listTab: ReviewListTab
  initialWorkerId: string
  initialUserId: string
}) {
  const { filters, update, reset } = useReviewFilters({
    tab: listTab,
    workerId: initialWorkerId,
    userId: initialUserId,
  })
  const { reviews, isLoading, error, mutate } = useReviewList(filters)
  const { categories } = useWorkerFilterOptions()

  return (
    <div className="flex flex-col gap-4">
      <ReviewFilterBar
        filters={filters}
        onChange={update}
        onReset={reset}
        cities={KNOWN_CITIES}
        categories={categories}
      />

      <ReviewTable
        tab={listTab}
        rows={reviews?.data ?? []}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
      />

      {reviews && (
        <Pager
          page={filters.page}
          pageSize={filters.pageSize}
          total={reviews.total}
          onPage={(page) => update({ page })}
        />
      )}
    </div>
  )
}

export default function ReviewsSection() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const workerId = searchParams.get('workerId') ?? ''
  const userId = searchParams.get('userId') ?? ''

  // /reviews?flagged=true (dashboard link) is the default tab anyway.
  // A worker or user filter only makes sense on "All reviews".
  const initialTab: ReviewTab =
    workerId || userId
      ? 'all'
      : (REVIEW_TABS as readonly string[]).includes(tabParam ?? '')
        ? (tabParam as ReviewTab)
        : 'flagged'

  const [tab, setTab] = useState<ReviewTab>(initialTab)
  const { counts } = useReviewCounts()

  const badge = (t: ReviewTab): string | null => {
    if (!counts) return t === 'audit' ? null : '–'
    if (t === 'flagged') return counts.flagged.toLocaleString('en-PK')
    if (t === 'all') return counts.total.toLocaleString('en-PK')
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {REVIEW_TABS.map((t) => {
            const active = tab === t
            const b = badge(t)
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors duration-150',
                  active
                    ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {TAB_LABEL[t]}
                {b !== null && (
                  <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{b}</span>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">{TAB_HINT[tab]}</p>
      </div>

      {tab === 'audit' ? (
        <RatingAuditTab />
      ) : (
        <ReviewQueue
          key={tab}
          listTab={tab}
          initialWorkerId={tab === 'all' ? workerId : ''}
          initialUserId={tab === 'all' ? userId : ''}
        />
      )}
    </div>
  )
}