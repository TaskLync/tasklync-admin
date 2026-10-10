// components/bookings/BookingHeader.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { STATUS_LABEL } from '@/lib/booking-constants'
import {
  PAYMENT_LABEL,
  PAYMENT_TONE,
  STATUS_TONE,
  STUCK_LABEL,
  STUCK_TONE,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPkr,
  shortId,
  stuckLevel,
} from './booking-ui'
import type { BookingDetail } from '@/types/booking'

function BookingHeaderSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-end gap-2">
              <div className="h-6 w-16 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-14 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-full max-w-[140px] animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </Card>
  )
}

interface Props {
  booking?: BookingDetail
  isLoading?: boolean
  error?: unknown
}

export default function BookingHeader({ booking, isLoading, error }: Props) {
  if (error) return null
  if (isLoading || !booking) return <BookingHeaderSkeleton />

  const p = booking.pricing
  const level = stuckLevel(booking)

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-gray-900">{shortId(booking.id)}</h1>
            <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
            <Badge tone={PAYMENT_TONE[booking.paymentStatus]}>
              {PAYMENT_LABEL[booking.paymentStatus]}
            </Badge>
            {booking.isUrgent && <Badge tone="danger">Urgent</Badge>}
            {booking.dispute && <Badge tone="danger">Dispute</Badge>}
            {level !== 'ok' && <Badge tone={STUCK_TONE[level]}>{STUCK_LABEL[level]}</Badge>}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {booking.categoryName ?? booking.categoryId}
            {booking.serviceName && ` · ${booking.serviceName}`}
            {booking.city && ` · ${booking.city}`}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-gray-400">{booking.id}</p>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatPkr(p.estimatedTotal, p.currency)}
            </p>
            <p className="text-xs text-gray-400">Quoted total</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatPkr(p.platformFee, p.currency)}
            </p>
            <p className="text-xs text-gray-400">Platform fee</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatPkr(p.workerAmount, p.currency)}
            </p>
            <p className="text-xs text-gray-400">Worker payout</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatDuration(booking.durationHours)}
            </p>
            <p className="text-xs text-gray-400">Duration</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 sm:grid-cols-4">
        <p>Created {formatDate(booking.createdAt)}</p>
        <p>Scheduled {formatDateTime(booking.scheduledAt)}</p>
        <p>Type: {booking.serviceType === 'RECURRING' ? 'Recurring' : 'One-time'}</p>
        <p>Last update {formatDateTime(booking.updatedAt)}</p>
      </div>

      {(booking.status === 'CANCELLED' || booking.status === 'REJECTED') && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {booking.status === 'REJECTED' ? 'Rejected by the worker' : 'Cancelled'}
          {booking.cancelledBy && ` by ${booking.cancelledBy}`}
          {booking.cancellationReason && ` — ${booking.cancellationReason}`}
          {p.refundPercentage !== null && ` (refund ${p.refundPercentage}%)`}
        </p>
      )}
      {booking.dispute && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          <p className="min-w-0 flex-1">
            Dispute {booking.dispute.status.toLowerCase().replace(/_/g, ' ')}
            {booking.dispute.resolution &&
              ` — ${booking.dispute.resolution.toLowerCase().replace(/_/g, ' ')}`}
            {' · '}
            {booking.dispute.reason}
          </p>
          <Link
            href={`/disputes/${booking.dispute.id}`}
            className="shrink-0 font-medium underline hover:text-red-900"
          >
            Open dispute →
          </Link>
        </div>
      )}
      {booking.autoCompleted && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Auto-completed: the customer didn't confirm within 24 hours.
        </p>
      )}
    </Card>
  )
}