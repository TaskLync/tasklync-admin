'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { UserDetail } from '@/types/user'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'warning',
  banned: 'danger',
  deleted: 'danger',
}

function toLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function UserProfileHeaderSkeleton() {
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

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-full max-w-[140px] animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </Card>
  )
}

interface UserProfileHeaderProps {
  user?: UserDetail
  isLoading?: boolean
  error?: unknown
}

export default function UserProfileHeader({ user, isLoading, error }: UserProfileHeaderProps) {
  if (error) {
    return null
  }

  if (isLoading || !user) {
    return <UserProfileHeaderSkeleton />
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" width={56} height={56} className="rounded-full" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
              {(user.name ?? '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{user.name ?? 'Unnamed user'}</h1>
              <StatusBadge
                status={user.status}
                variant={STATUS_VARIANT[user.status] ?? 'neutral'}
                label={toLabel(user.status)}
              />
            </div>
            <p className="text-sm text-gray-500">
              {user.phone ?? '—'} · {user.email ?? '—'} · {user.defaultCity ?? 'No default city'}
            </p>
          </div>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-semibold text-gray-900">{user.totalBookings}</p>
            <p className="text-xs text-gray-400">Bookings</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{user.addressCount}</p>
            <p className="text-xs text-gray-400">Addresses</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{user.blockedWorkerCount}</p>
            <p className="text-xs text-gray-400">Blocked workers</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{user.warningCount}</p>
            <p className="text-xs text-gray-400">Warnings</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 sm:grid-cols-4">
        <p>
          Member since{' '}
          {new Date(user.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <p>Language: {user.preferredLanguage.toUpperCase()}</p>
        <p>Currency: {user.preferredCurrency}</p>
        <p>
          Push {user.pushEnabled ? 'on' : 'off'} · Email {user.emailEnabled ? 'on' : 'off'}
        </p>
      </div>

      {user.status === 'suspended' && user.suspendedUntil && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Suspended until {new Date(user.suspendedUntil).toLocaleString()} — {user.suspendedReason}
        </p>
      )}
      {user.status === 'banned' && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          Banned {user.bannedAt && new Date(user.bannedAt).toLocaleDateString()} — {user.bannedReason}
        </p>
      )}
    </Card>
  )
}