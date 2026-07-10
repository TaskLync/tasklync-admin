// components/dashboard/ActivityFeed.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useActivityFeed } from '@/hooks/useDashboard'
import type { PlatformEventType } from '@/types/dashboard'
import { formatDistanceToNow } from 'date-fns'

const EVENT_DOT: Record<PlatformEventType, string> = {
  'booking.created': 'bg-[#2563EB]',
  'worker.verified': 'bg-[#16A34A]',
  'payment.completed': 'bg-[#16A34A]',
  'booking.disputed': 'bg-[#DC2626]',
  'user.registered': 'bg-[#6B7280]',
}

export function ActivityFeed() {
  const { data: events, error, isLoading } = useActivityFeed()

  return (
    <Card className="flex max-h-[420px] flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Live Activity
      </h2>

      {error && <p className="text-sm text-red-600">Couldn't load activity feed.</p>}

      {isLoading && !events && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {events && events.length === 0 && (
        <p className="text-sm text-gray-400">No recent activity.</p>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto">
        {events?.map((event) => (
          <div key={event.id} className="flex items-start gap-2 text-sm">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${EVENT_DOT[event.event_type]}`} />
            <div className="flex flex-1 flex-col">
              <span className="text-gray-800">{event.message}</span>
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}