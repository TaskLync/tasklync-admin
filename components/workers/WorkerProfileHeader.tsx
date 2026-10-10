// components/workers/WorkerProfileHeader.tsx
'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  BADGE_LABEL,
  PRESENCE_LABEL,
  PRESENCE_TONE,
  STATUS_LABEL,
  STATUS_VARIANT,
  VERIFICATION_LABEL,
  VERIFICATION_VARIANT,
  formatDate,
  initial,
  timeAgo,
} from './worker-ui'
import type { WorkerDetail } from '@/types/worker'

function WorkerProfileHeaderSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-gray-100" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
          </div>
        </div>

        <div className="flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-end gap-2">
              <div className="h-6 w-8 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-14 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
        ))}
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
  worker?: WorkerDetail
  isLoading?: boolean
  error?: unknown
}

export default function WorkerProfileHeader({ worker, isLoading, error }: Props) {
  if (error) return null
  if (isLoading || !worker) return <WorkerProfileHeaderSkeleton />

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {worker.avatarUrl ? (
            <Image
              src={worker.avatarUrl}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
              {initial(worker.name)}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{worker.name ?? 'Unnamed worker'}</h1>
              <StatusBadge
                status={worker.status}
                variant={STATUS_VARIANT[worker.status] ?? 'neutral'}
                label={STATUS_LABEL[worker.status] ?? worker.status}
              />
              <StatusBadge
                status={worker.verificationStatus}
                variant={VERIFICATION_VARIANT[worker.verificationStatus] ?? 'neutral'}
                label={VERIFICATION_LABEL[worker.verificationStatus] ?? worker.verificationStatus}
              />
              <Badge tone={PRESENCE_TONE[worker.presence] ?? 'neutral'}>
                {PRESENCE_LABEL[worker.presence] ?? worker.presence}
              </Badge>
              {worker.isFeatured && <Badge tone="info">★ Featured</Badge>}
              {worker.badges.map((b) => (
                <Badge key={b} tone="info">{BADGE_LABEL[b] ?? b}</Badge>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              {worker.phone ?? '—'} · {worker.email ?? '—'} · {worker.city ?? 'No city'}
            </p>
          </div>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-semibold text-gray-900">{worker.totalBookings}</p>
            <p className="text-xs text-gray-400">Jobs</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {worker.totalReviews > 0 ? worker.avgRating.toFixed(1) : '—'}
            </p>
            <p className="text-xs text-gray-400">Rating ({worker.totalReviews})</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{worker.responseTimeMins}</p>
            <p className="text-xs text-gray-400">Response (min)</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{worker.warningCount}</p>
            <p className="text-xs text-gray-400">Warnings</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {worker.skills.length > 0 ? (
          worker.skills.map((s) => (
            <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {s}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">No skills added yet.</span>
        )}
      </div>

      {worker.bio && <p className="mt-3 text-sm text-gray-600">{worker.bio}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 sm:grid-cols-4">
        <p>Member since {formatDate(worker.createdAt)}</p>
        <p>
          Experience: {worker.yearsExperience} {worker.yearsExperience === 1 ? 'year' : 'years'}
        </p>
        <p>
          Language: {worker.preferredLanguage.toUpperCase()} · Currency: {worker.currency}
        </p>
        <p>Last seen {timeAgo(worker.lastSeenAt)}</p>
      </div>

      {worker.status === 'suspended' && worker.suspendedUntil && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Suspended until {new Date(worker.suspendedUntil).toLocaleString()} — {worker.suspendedReason}
        </p>
      )}
      {worker.status === 'banned' && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          Banned {worker.bannedAt && new Date(worker.bannedAt).toLocaleDateString()} — {worker.bannedReason}
        </p>
      )}
      {worker.reverificationRequestedAt && worker.verificationStatus === 'unverified' && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Re-verification requested {formatDate(worker.reverificationRequestedAt)} — {worker.reverificationReason}
        </p>
      )}
    </Card>
  )
}