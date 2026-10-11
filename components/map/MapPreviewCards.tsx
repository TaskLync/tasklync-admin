// components/map/MapPreviewCards.tsx
'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { STATUS_LABEL } from '@/lib/booking-constants'
import { PRESENCE_COLOR } from '@/lib/map-constants'
import { PRESENCE_LABEL, PRESENCE_TONE, initial, timeAgo } from '@/components/workers/worker-ui'
import { STATUS_TONE, formatDateTime, formatPkr, shortId } from '@/components/bookings/booking-ui'
import type { MapJob, MapWorker } from '@/types/map'

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Close"
      className="cursor-pointer flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-600"
    >
      <X size={15} />
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{children}</span>
    </div>
  )
}

export function WorkerPreviewCard({ worker, onClose }: { worker: MapWorker; onClose: () => void }) {
  return (
    <Card className="w-80 p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: PRESENCE_COLOR[worker.presence] }}
        >
          {initial(worker.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{worker.name ?? 'Unnamed worker'}</p>
          <p className="truncate text-xs text-gray-500">{worker.categories ?? 'No categories'}</p>
          <div className="mt-1">
            <Badge tone={PRESENCE_TONE[worker.presence]}>{PRESENCE_LABEL[worker.presence]}</Badge>
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100 pt-2">
        <Row label="Rating">
          {worker.totalReviews > 0
            ? `${worker.avgRating.toFixed(1)} (${worker.totalReviews})`
            : 'No reviews yet'}
        </Row>
        <Row label="City">{worker.city ?? '—'}</Row>
        <Row label="Last seen">{timeAgo(worker.lastSeenAt)}</Row>
        <Row label="GPS updated">{timeAgo(worker.locationUpdatedAt)}</Row>
        <Row label="Active booking">
          {worker.activeBookingId ? (
            <Link
              href={`/bookings/${worker.activeBookingId}`}
              className="font-mono text-[#1F6F5F] hover:underline"
            >
              {shortId(worker.activeBookingId)}
            </Link>
          ) : (
            <span className="text-gray-400">None</span>
          )}
        </Row>
      </div>

      <Link
        href={`/workers/${worker.id}`}
        className="mt-3 flex h-9 items-center justify-center rounded-md bg-[#1F6F5F] text-sm font-medium text-white transition-colors duration-150 hover:bg-[#195c4f]"
      >
        Open worker profile
      </Link>
    </Card>
  )
}

export function JobPreviewCard({ job, onClose }: { job: MapJob; onClose: () => void }) {
  return (
    <Card className="w-80 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold text-gray-900">{shortId(job.id)}</p>
            <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {job.categoryName ?? job.categoryId}
            {job.city && ` · ${job.city}`}
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100 pt-2">
        <Row label="Customer">{job.userName ?? '—'}</Row>
        <Row label="Worker">
          {job.workerId ? (
            <Link href={`/workers/${job.workerId}`} className="text-[#1F6F5F] hover:underline">
              {job.workerName ?? 'Unnamed'}
            </Link>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Amount">{formatPkr(job.amount, job.currency)}</Row>
        <Row label="Scheduled">{formatDateTime(job.scheduledAt)}</Row>
        <Row label="Worker GPS">
          {job.workerLat === null ? (
            <span className="text-gray-400">Not available</span>
          ) : (
            timeAgo(job.workerLocationAt)
          )}
        </Row>
      </div>

      <Link
        href={`/bookings/${job.id}`}
        className="mt-3 flex h-9 items-center justify-center rounded-md bg-[#1F6F5F] text-sm font-medium text-white transition-colors duration-150 hover:bg-[#195c4f]"
      >
        Open booking
      </Link>
    </Card>
  )
}