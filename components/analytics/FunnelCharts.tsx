// components/analytics/FunnelCharts.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useAnalyticsFunnels } from '@/hooks/useAnalytics'
import type { AnalyticsRange, FunnelStage } from '@/types/analytics'

function FunnelCard({
  title,
  hint,
  stages,
  color,
}: {
  title: string
  hint: string
  stages: FunnelStage[]
  color: string
}) {
  const empty = stages.length === 0 || stages[0].count === 0

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-400">{hint}</p>
      </div>

      {empty ? (
        <p className="py-8 text-center text-sm text-gray-400">Nobody registered in this period yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {stages.map((s, i) => (
            <div key={s.stage} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-600">{s.stage}</span>
                <span className="text-xs text-gray-400">
                  {s.count.toLocaleString('en-PK')} · {s.pctOfStart}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-colors duration-150"
                  style={{ width: `${s.pctOfStart}%`, backgroundColor: color }}
                />
              </div>
              {i > 0 && (
                <span className={s.dropOffPct >= 50 ? 'text-xs text-[#DC2626]' : 'text-xs text-gray-400'}>
                  {s.dropOffPct}% dropped since previous step
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function FunnelCharts({ days }: { days: AnalyticsRange }) {
  const { funnels, isLoading, error, mutate } = useAnalyticsFunnels(days)

  if (error && !funnels) {
    return (
      <Card className="p-4 text-sm text-red-600">
        {error.message || "Couldn't load funnels."}{' '}
        <button onClick={() => mutate()} className="underline">
          Retry
        </button>
      </Card>
    )
  }

  if (isLoading || !funnels) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <FunnelCard
        title="User funnel"
        hint={`Users who registered in the last ${days} days, and how far they got.`}
        stages={funnels.user}
        color="#1F6F5F"
      />
      <FunnelCard
        title="Worker funnel"
        hint={`Workers who registered in the last ${days} days, from signup to first completed job.`}
        stages={funnels.worker}
        color="#2563EB"
      />
    </div>
  )
}