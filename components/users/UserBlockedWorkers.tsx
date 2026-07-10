// components/users/UserBlockedWorkers.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useUserBlockedWorkers } from '@/hooks/useUsers'

export default function UserBlockedWorkers({ userId }: { userId: string }) {
  const { blockedWorkers, isLoading } = useUserBlockedWorkers(userId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Blocked Workers</h2>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-gray-100 p-2">
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-28 animate-pulse rounded bg-gray-100" />
                <div className="h-2.5 w-36 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="h-2.5 w-10 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : blockedWorkers.length === 0 ? (
        <p className="text-sm text-gray-500">This user hasn't blocked any workers.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {blockedWorkers.map((w) => (
            <li key={w.id} className="flex items-center justify-between rounded-md border border-gray-100 p-2 text-sm">
              <div>
                <p className="font-medium text-gray-900">{w.workerName ?? 'Unknown worker'}</p>
                <p className="text-xs text-gray-400">{w.workerCategory ?? '—'} · {w.workerPhone ?? '—'}</p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(w.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}