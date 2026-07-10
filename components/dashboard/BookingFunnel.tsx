// components/dashboard/BookingFunnel.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useBookingFunnel } from '@/hooks/useDashboard'

export function BookingFunnel() {
  const { data, error, isLoading } = useBookingFunnel()

  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Booking Status Funnel
        <span className="ml-2 normal-case text-xs font-normal text-gray-400">
          last 30 days
        </span>
      </h2>

      {error && <p className="text-sm text-red-600">Couldn't load funnel data.</p>}

      {isLoading && !data && (
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 flex-1 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {data.map((stage, i) => (
            <div key={stage.stage} className="flex flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-500">{stage.stage}</span>
                <span className="text-xs text-gray-400">{stage.pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#1F6F5F] transition-colors duration-150"
                  style={{ width: `${stage.pct}%` }}
                />
              </div>
              <span className="text-lg font-semibold text-gray-900">
                {stage.count.toLocaleString()}
              </span>
              {i > 0 && (
                <span className="text-xs text-gray-400">
                  {(100 - stage.pct).toFixed(1)}% dropped since Created
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}