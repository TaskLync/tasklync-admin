// components/bookings/BookingStatusTimeline.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { STATUS_LABEL } from '@/lib/booking-constants'
import { useBookingTimeline } from '@/hooks/useBookings'
import { STATUS_TONE, formatDateTime, timeAgo } from './booking-ui'
import type { BookingDetail, BookingStatusHistoryRow } from '@/types/booking'

function actorLabel(actor: string | null): string {
  if (!actor) return 'Platform (customer / worker / system)'
  if (actor.startsWith('admin:')) return `Admin · ${actor.slice(6)}`
  return actor
}

/** Fallback when booking_status_history doesn't exist yet. */
function deriveRows(b: BookingDetail): BookingStatusHistoryRow[] {
  const rows: BookingStatusHistoryRow[] = [
    { id: 1, fromStatus: null, toStatus: 'PENDING', actor: null, isBackfilled: true, changedAt: b.createdAt },
  ]
  if (b.startedAt) {
    rows.push({ id: 2, fromStatus: null, toStatus: 'IN_PROGRESS', actor: null, isBackfilled: true, changedAt: b.startedAt })
  }
  if (b.status !== 'PENDING') {
    rows.push({ id: 3, fromStatus: null, toStatus: b.status, actor: null, isBackfilled: true, changedAt: b.updatedAt })
  }
  return rows
}

export default function BookingStatusTimeline({ booking }: { booking: BookingDetail }) {
  const { timeline, isLoading, error, mutate } = useBookingTimeline(booking.id)

  const rows = timeline
    ? timeline.available
      ? timeline.data
      : deriveRows(booking)
    : []
  const hasApproximate = rows.some((r) => r.isBackfilled)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Status history
      </h2>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : error || !timeline ? (
        <p className="text-sm text-gray-500">
          Couldn't load the status history.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No status changes recorded.</p>
      ) : (
        <>
          <ol className="relative ml-2 border-l border-gray-200">
            {rows.map((r, i) => {
              const isLast = i === rows.length - 1
              return (
                <li key={r.id} className="mb-4 ml-4 last:mb-0">
                  <span
                    className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-white ${
                      isLast ? 'bg-[#1F6F5F]' : 'bg-gray-300'
                    }`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[r.toStatus]}>{STATUS_LABEL[r.toStatus]}</Badge>
                    {r.fromStatus && (
                      <span className="text-xs text-gray-400">
                        from {STATUS_LABEL[r.fromStatus] ?? r.fromStatus}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatDateTime(r.changedAt)} · {timeAgo(r.changedAt)}
                  </p>
                  <p className="text-xs text-gray-400">{actorLabel(r.actor)}</p>
                </li>
              )
            })}
          </ol>
          {(hasApproximate || !timeline.available) && (
            <p className="mt-3 text-xs text-gray-400">
              {timeline.available
                ? 'Entries marked from before status tracking was enabled are approximate.'
                : 'Detailed history isn\'t available yet; showing milestones from the booking itself.'}
            </p>
          )}
        </>
      )}
    </Card>
  )
}