// components/workers/WorkerAvailability.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useWorkerAvailability } from '@/hooks/useWorkers'
import { DAY_NAMES, formatDate } from './worker-ui'

export default function WorkerAvailability({ workerId }: { workerId: string }) {
  const { availability, isLoading, error } = useWorkerAvailability(workerId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Availability</h2>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : error || !availability ? (
        <p className="text-sm text-gray-500">Couldn't load availability.</p>
      ) : (
        <>
          {availability.recurring.length === 0 ? (
            <p className="text-sm text-gray-500">No weekly schedule set.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {DAY_NAMES.map((day, index) => {
                const slot = availability.recurring.find((s) => s.dayOfWeek === index)
                return (
                  <li key={day} className="flex items-center justify-between">
                    <span className={slot ? 'text-gray-900' : 'text-gray-400'}>{day}</span>
                    <span className={slot ? 'font-mono text-xs text-gray-700' : 'text-xs text-gray-400'}>
                      {slot ? `${slot.startTime} – ${slot.endTime}` : 'Off'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-medium text-gray-700">Upcoming blocked dates</p>
            {availability.blocked.length === 0 ? (
              <p className="text-sm text-gray-500">None.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {availability.blocked.map((b) => (
                  <li key={b.id} className="rounded-md border border-gray-100 p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{formatDate(b.blockedDate)}</span>
                      <span className="text-xs text-gray-400">
                        {b.startTime && b.endTime ? `${b.startTime} – ${b.endTime}` : 'Full day'}
                      </span>
                    </div>
                    {b.reason && <p className="mt-0.5 text-xs text-gray-500">{b.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  )
}