// components/workers/WorkerEarnings.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useWorkerEarnings } from '@/hooks/useWorkers'
import { formatPkr } from './worker-ui'

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-100 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

export default function WorkerEarnings({ workerId }: { workerId: string }) {
  const { earnings, isLoading, error, mutate } = useWorkerEarnings(workerId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Earnings</h2>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : error || !earnings ? (
        <p className="text-sm text-gray-500">
          Couldn't load earnings.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">Retry</button>
        </p>
      ) : !earnings.available ? (
        <p className="text-sm text-gray-500">
          Earnings aren't wired up yet — pending the worker earnings schema.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="This month" value={formatPkr(earnings.thisMonth, earnings.currency)} />
          <Tile label="Last month" value={formatPkr(earnings.lastMonth, earnings.currency)} />
          <Tile label="Lifetime" value={formatPkr(earnings.lifetime, earnings.currency)} />
        </div>
      )}
    </Card>
  )
}