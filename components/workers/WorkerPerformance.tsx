// components/workers/WorkerPerformance.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useWorkerPerformance } from '@/hooks/useWorkers'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-100 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

const pct = (n: number | null) => (n === null ? '—' : `${n.toFixed(0)}%`)

export default function WorkerPerformance({ workerId }: { workerId: string }) {
  const { stats, isLoading, error, mutate } = useWorkerPerformance(workerId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Performance</h2>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-full animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        </div>
      ) : error || !stats ? (
        <p className="text-sm text-gray-500">
          Couldn't load performance.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">Retry</button>
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Completed jobs" value={stats.completedJobs === null ? '—' : String(stats.completedJobs)} />
            <Tile label="Acceptance rate" value={pct(stats.acceptanceRate)} />
            <Tile label="Cancellation rate" value={pct(stats.cancellationRate)} />
            <Tile label="Avg response" value={`${stats.responseTimeMins} min`} />
          </div>

          {!stats.available && (
            <p className="text-sm text-gray-500">
              Job stats aren't wired up yet — they'll appear here once the bookings table is reachable.
            </p>
          )}

          {stats.ratingBreakdown ? (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-700">
                Rating breakdown · {stats.totalReviews > 0 ? `${stats.avgRating.toFixed(1)} average` : 'no reviews yet'}
              </p>
              <div className="flex flex-col gap-1.5">
                {(['5', '4', '3', '2', '1'] as const).map((star) => {
                  const count = stats.ratingBreakdown![star]
                  const width = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="w-6 shrink-0">{star} ★</span>
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-[#D97706]"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Rating breakdown isn't wired up yet — pending the Reviews page schema.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}