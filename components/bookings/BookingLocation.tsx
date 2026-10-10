// components/bookings/BookingLocation.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { useBookingLocation, useBookingTimeline } from '@/hooks/useBookings'
import { formatDateTime } from './booking-ui'
import type { BookingDetail, TrailPoint } from '@/types/booking'

const W = 320
const H = 170

function TrailPlot({
  trail,
  site,
}: {
  trail: TrailPoint[]
  site: { lat: number; lng: number } | null
}) {
  const pts = [
    ...trail.map((p) => ({ x: p.lng, y: p.lat })),
    ...(site ? [{ x: site.lng, y: site.lat }] : []),
  ]
  const minX = Math.min(...pts.map((p) => p.x))
  const maxX = Math.max(...pts.map((p) => p.x))
  const minY = Math.min(...pts.map((p) => p.y))
  const maxY = Math.max(...pts.map((p) => p.y))
  const spanX = Math.max(maxX - minX, 1e-5)
  const spanY = Math.max(maxY - minY, 1e-5)

  const toX = (x: number) => 12 + ((x - minX) / spanX) * (W - 24)
  const toY = (y: number) => H - 12 - ((y - minY) / spanY) * (H - 24)

  const line = trail.map((p) => `${toX(p.lng)},${toY(p.lat)}`).join(' ')
  const last = trail[trail.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full rounded-md border border-gray-200 bg-gray-50">
      {trail.length > 1 && (
        <polyline points={line} fill="none" stroke="#1F6F5F" strokeWidth={2} strokeLinejoin="round" />
      )}
      {trail.length > 0 && (
        <circle cx={toX(trail[0].lng)} cy={toY(trail[0].lat)} r={4} fill="#9CA3AF">
          <title>Start of trail</title>
        </circle>
      )}
      {last && (
        <circle cx={toX(last.lng)} cy={toY(last.lat)} r={5} fill="#1F6F5F">
          <title>Last known position</title>
        </circle>
      )}
      {site && (
        <circle cx={toX(site.lng)} cy={toY(site.lat)} r={6} fill="#DC2626">
          <title>Job site</title>
        </circle>
      )}
    </svg>
  )
}

function Milestone({ label, value }: { label: string; value: string | null }) {
  return (
    <li className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={value ? 'text-gray-900' : 'text-gray-300'}>{value ?? 'Not tracked'}</span>
    </li>
  )
}

export default function BookingLocation({ booking }: { booking: BookingDetail }) {
  const { location, isLoading, error, mutate } = useBookingLocation(booking.id)
  const { timeline } = useBookingTimeline(booking.id)

  const acceptedAt =
    timeline?.available
      ? (timeline.data.find((r) => r.toStatus === 'ACCEPTED')?.changedAt ?? null)
      : null

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Location timeline
      </h2>

      {isLoading ? (
        <div className="h-44 animate-pulse rounded bg-gray-100" />
      ) : error || !location ? (
        <p className="text-sm text-gray-500">
          Couldn't load location data.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            {location.trailAvailable && location.trail.length > 0 ? (
              <>
                <TrailPlot trail={location.trail} site={location.jobSite} />
                <p className="mt-1 text-xs text-gray-400">
                  {location.trail.length} GPS points · {formatDateTime(location.trail[0].recordedAt)} →{' '}
                  {formatDateTime(location.trail[location.trail.length - 1].recordedAt)}.{' '}
                  <span className="text-[#DC2626]">●</span> job site{' '}
                  <span className="text-[#1F6F5F]">●</span> last position
                </p>
              </>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-gray-200 px-4 text-center text-sm text-gray-400">
                {location.trailAvailable
                  ? 'No GPS points were recorded for this booking.'
                  : 'The GPS history table isn\'t reachable from the admin panel yet.'}
              </div>
            )}
          </div>

          <ul className="divide-y divide-gray-100">
            <Milestone label="Booking created" value={formatDateTime(booking.createdAt)} />
            <Milestone label="Worker accepted" value={acceptedAt ? formatDateTime(acceptedAt) : null} />
            <Milestone label="Worker departed" value={null} />
            <Milestone label="Worker arrived" value={null} />
            <Milestone
              label="Job started"
              value={booking.startedAt ? formatDateTime(booking.startedAt) : null}
            />
            <Milestone
              label="Job completed"
              value={booking.completedAt ? formatDateTime(booking.completedAt) : null}
            />
          </ul>
        </div>
      )}
    </Card>
  )
}