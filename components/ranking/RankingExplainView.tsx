'use client'

import { useState } from 'react'
import { usePermission } from '@/hooks/usePermission'
import { useRankingExplain, type ExplainQuery } from '@/hooks/useRanking'
import ExplainSearchForm from '@/components/ranking/ExplainSearchForm'
import ExplainSummary from '@/components/ranking/ExplainSummary'
import ExplainTerms from '@/components/ranking/ExplainTerms'
import ExplainAdjustments from '@/components/ranking/ExplainAdjustments'
import ExplainPerformance from '@/components/ranking/ExplainPerformance'

export default function RankingExplainView({ workerId }: { workerId: string }) {
  const allowed = usePermission('ranking:view')
  const [query, setQuery] = useState<ExplainQuery>({})
  const { explain, error, isLoading, isValidating, mutate } = useRankingExplain(workerId, query)

  if (!allowed) {
    return <div className="rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">You do not have access to ranking details.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Why this rank?</h1>
        <p className="text-sm text-gray-500">Read-only. Shows exactly how search scores this worker, term by term. Nothing here changes any setting.</p>
      </div>

      <ExplainSearchForm value={query} busy={isValidating} onApply={setQuery} />

      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
          {error.message || "Couldn't load the explanation."}{' '}
          <button onClick={() => mutate()} className="text-accent hover:underline">Retry</button>
        </div>
      )}

      {explain && !isLoading && (
        <>
          <ExplainSummary e={explain} />
          <ExplainTerms e={explain} />
          <ExplainAdjustments e={explain} />
          <ExplainPerformance e={explain} />
        </>
      )}
    </div>
  )
}