// components/bookings/BookingParties.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  PRESENCE_LABEL,
  PRESENCE_TONE,
  STATUS_LABEL as ACCOUNT_STATUS_LABEL,
  STATUS_VARIANT as ACCOUNT_STATUS_VARIANT,
  VERIFICATION_LABEL,
  VERIFICATION_VARIANT,
  initial,
} from '@/components/workers/worker-ui'
import type { WorkerPresence, WorkerStatus, WorkerVerificationStatus } from '@/types/worker'
import type { BookingDetail } from '@/types/booking'

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={40}
      height={40}
      unoptimized
      className="h-10 w-10 rounded-full object-cover"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm text-gray-500">
      {initial(name)}
    </div>
  )
}

export default function BookingParties({ booking }: { booking: BookingDetail }) {
  const { user, worker } = booking

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Parties</h2>

      <div className="flex flex-col gap-4">
        {/* Customer */}
        <div className="flex items-start gap-3">
          <Avatar url={user.avatarUrl} name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-400">Customer</p>
            {user.id ? (
              <Link href={`/users/${user.id}`} className="font-medium text-gray-900 hover:text-[#1F6F5F] hover:underline">
                {user.name ?? 'Unnamed user'}
              </Link>
            ) : (
              <p className="font-medium text-gray-900">{user.name ?? 'Unknown user'}</p>
            )}
            <p className="font-mono text-xs text-gray-500">{user.phone ?? '—'}</p>
            {user.email && <p className="truncate text-xs text-gray-400">{user.email}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              {user.status && (
                <StatusBadge
                  status={user.status}
                  variant={ACCOUNT_STATUS_VARIANT[user.status as WorkerStatus] ?? 'neutral'}
                  label={ACCOUNT_STATUS_LABEL[user.status as WorkerStatus] ?? user.status}
                />
              )}
              <span>{user.totalBookings} bookings</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Worker */}
        <div className="flex items-start gap-3">
          <Avatar url={worker.avatarUrl} name={worker.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-400">Worker</p>
            {worker.id ? (
              <Link href={`/workers/${worker.id}`} className="font-medium text-gray-900 hover:text-[#1F6F5F] hover:underline">
                {worker.name ?? 'Unnamed worker'}
              </Link>
            ) : (
              <p className="font-medium text-gray-900">{worker.name ?? 'Unknown worker'}</p>
            )}
            <p className="font-mono text-xs text-gray-500">{worker.phone ?? '—'}</p>
            <p className="text-xs text-gray-400">
              {worker.totalReviews > 0
                ? `★ ${worker.avgRating.toFixed(1)} (${worker.totalReviews})`
                : 'No reviews yet'}
              {worker.city && ` · ${worker.city}`}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {worker.verificationStatus && (
                <StatusBadge
                  status={worker.verificationStatus}
                  variant={VERIFICATION_VARIANT[worker.verificationStatus as WorkerVerificationStatus] ?? 'neutral'}
                  label={VERIFICATION_LABEL[worker.verificationStatus as WorkerVerificationStatus] ?? worker.verificationStatus}
                />
              )}
              {worker.presence && (
                <Badge tone={PRESENCE_TONE[worker.presence as WorkerPresence] ?? 'neutral'}>
                  {PRESENCE_LABEL[worker.presence as WorkerPresence] ?? worker.presence}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}