// components/verification/VerificationQueueSection.tsx
'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import {
  useVerificationCounts,
  useVerificationFilters,
  useVerificationQueue,
} from '@/hooks/useVerification'
import { useWorkerFilterOptions } from '@/hooks/useWorkers'
import { QUEUE_TABS, type QueueTab } from '@/lib/verification-constants'
import VerificationFilterBar from './VerificationFilterBar'
import VerificationTable from './VerificationTable'

const KNOWN_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi']

const TAB_LABEL: Record<QueueTab, string> = {
  pending: 'Pending review',
  resubmitted: 'Re-submitted',
  approved: 'Approved (30d)',
  rejected: 'Rejected (30d)',
}

const TAB_HINT: Record<QueueTab, string> = {
  pending: 'Oldest first. Rows turn amber after 48h and red after 72h.',
  resubmitted: 'Workers who were rejected or asked to re-verify and have uploaded again. Oldest first.',
  approved: 'Verified in the last 30 days.',
  rejected: 'Rejected in the last 30 days, with the reason given.',
}

export default function VerificationQueueSection() {
  const { filters, update, reset } = useVerificationFilters()
  const { queue, isLoading, error, mutate } = useVerificationQueue(filters)
  const { counts } = useVerificationCounts()
  const { categories } = useWorkerFilterOptions()

  const totalPages = queue?.totalPages ?? 1

  const pageSummary = useMemo(() => {
    if (!queue) return ''
    const start = (queue.page - 1) * queue.pageSize + 1
    const end = Math.min(queue.page * queue.pageSize, queue.total)
    return `${start}–${end} of ${queue.total}`
  }, [queue])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {QUEUE_TABS.map((tab) => {
            const active = filters.tab === tab
            return (
              <button
                key={tab}
                onClick={() => update({ tab })}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors duration-150',
                  active
                    ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {TAB_LABEL[tab]}
                <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">
                  {counts ? counts[tab].toLocaleString('en-PK') : '–'}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">{TAB_HINT[filters.tab]}</p>
      </div>

      <VerificationFilterBar
        filters={filters}
        onChange={update}
        onReset={reset}
        cities={KNOWN_CITIES}
        categories={categories}
      />

      <VerificationTable
        tab={filters.tab}
        rows={queue?.data ?? []}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
      />

      {queue && queue.total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{pageSummary}</span>
          <div className="flex gap-2">
            <button
              className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
              disabled={filters.page <= 1}
              onClick={() => update({ page: filters.page - 1 })}
            >
              Previous
            </button>
            <button
              className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
              disabled={filters.page >= totalPages}
              onClick={() => update({ page: filters.page + 1 })}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}