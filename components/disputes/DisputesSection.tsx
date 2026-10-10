// components/disputes/DisputesSection.tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'
import { DISPUTE_TABS, type DisputeTab, type DisputeView } from '@/lib/dispute-constants'
import { useDisputeCounts, useDisputeFilters, useDisputeList } from '@/hooks/useDisputes'
import { useWorkerFilterOptions } from '@/hooks/useWorkers'
import DisputeFilterBar from './DisputeFilterBar'
import DisputeRefundsTab from './DisputeRefundsTab'
import DisputeTable from './DisputeTable'
import { KNOWN_CITIES, Pager } from './dispute-ui'

const TAB_LABEL: Record<DisputeTab, string> = {
  open: 'Open',
  awaiting: 'Awaiting response',
  escalated: 'Escalated',
  resolved: 'Resolved (30d)',
}

const TAB_HINT: Record<DisputeTab, string> = {
  open: 'Needs an admin decision. Oldest first. Rows turn amber after 48h and red after 72h.',
  awaiting: 'Waiting for the worker to answer. They get 24h before it moves to Open.',
  escalated: 'Flagged for Super Admin review. Only a Super Admin can resolve these.',
  resolved: 'Decisions from the last 30 days, newest first.',
}

const VIEW_LABEL: Record<DisputeView, string> = {
  disputes: 'Disputes',
  refunds: 'Refunds',
}

function DisputeQueue({ initialTab }: { initialTab?: DisputeTab }) {
  const { filters, update, reset } = useDisputeFilters(initialTab ? { tab: initialTab } : {})
  const { disputes, isLoading, error, mutate } = useDisputeList(filters)
  const { counts } = useDisputeCounts()
  const { categories } = useWorkerFilterOptions()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {DISPUTE_TABS.map((tab) => {
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

      <DisputeFilterBar
        filters={filters}
        onChange={update}
        onReset={reset}
        cities={KNOWN_CITIES}
        categories={categories}
      />

      <DisputeTable
        tab={filters.tab}
        rows={disputes?.data ?? []}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
      />

      {disputes && (
        <Pager
          page={filters.page}
          pageSize={filters.pageSize}
          total={disputes.total}
          onPage={(page) => update({ page })}
        />
      )}
    </div>
  )
}

export default function DisputesSection() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const validTab = (DISPUTE_TABS as readonly string[]).includes(tabParam ?? '')

  const [view, setView] = useState<DisputeView>(
    searchParams.get('view') === 'refunds' ? 'refunds' : 'disputes'
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit rounded-md border border-gray-300 bg-white p-0.5">
        {(['disputes', 'refunds'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'h-8 rounded px-4 text-sm transition-colors duration-150',
              view === v
                ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {view === 'disputes' ? (
        <DisputeQueue initialTab={validTab ? (tabParam as DisputeTab) : undefined} />
      ) : (
        <DisputeRefundsTab />
      )}
    </div>
  )
}