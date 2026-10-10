// components/workers/WorkerTable.tsx
'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Star } from 'lucide-react'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import {
  PRESENCE_LABEL,
  PRESENCE_TONE,
  STATUS_LABEL,
  STATUS_VARIANT,
  VERIFICATION_LABEL,
  VERIFICATION_VARIANT,
  formatDate,
  initial,
} from './worker-ui'
import type { WorkerListItem } from '@/types/worker'

interface Props {
  rows: WorkerListItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

export default function WorkerTable({ rows, isLoading, error, onRetry }: Props) {
  const router = useRouter()

  const columns: DataTableColumn<WorkerListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (w) => (
        <div className="flex items-center gap-2">
          {w.avatarUrl ? (
            <Image
              src={w.avatarUrl}
              alt=""
              width={24}
              height={24}
              unoptimized
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-gray-200 text-center text-[10px] leading-6 text-gray-500">
              {initial(w.name)}
            </div>
          )}
          <span className="font-medium text-gray-900">{w.name ?? 'Unnamed'}</span>
          {w.isFeatured && (
            <Star size={12} className="fill-[#D97706] text-[#D97706]" aria-label="Featured" />
          )}
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (w) => w.phone ?? '—', className: 'font-mono text-xs' },
    { key: 'city', header: 'City', render: (w) => w.city ?? '—' },
    {
      key: 'category',
      header: 'Category',
      render: (w) => w.categories ?? '—',
      className: 'max-w-[180px] truncate',
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (w) =>
        w.totalReviews > 0 ? (
          <span className={w.avgRating < 3 ? 'font-medium text-[#D97706]' : ''}>
            ★ {w.avgRating.toFixed(1)}{' '}
            <span className="text-xs text-gray-400">({w.totalReviews})</span>
          </span>
        ) : (
          <span className="text-gray-400">New</span>
        ),
    },
    { key: 'jobs', header: 'Jobs', render: (w) => w.totalBookings },
    {
      key: 'verification',
      header: 'Verified',
      render: (w) => (
        <StatusBadge
          status={w.verificationStatus}
          variant={VERIFICATION_VARIANT[w.verificationStatus] ?? 'neutral'}
          label={VERIFICATION_LABEL[w.verificationStatus] ?? w.verificationStatus}
        />
      ),
    },
    {
      key: 'presence',
      header: 'Presence',
      render: (w) => (
        <Badge tone={PRESENCE_TONE[w.presence] ?? 'neutral'}>
          {PRESENCE_LABEL[w.presence] ?? w.presence}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => (
        <StatusBadge
          status={w.status}
          variant={STATUS_VARIANT[w.status] ?? 'neutral'}
          label={STATUS_LABEL[w.status] ?? w.status}
        />
      ),
    },
    { key: 'joined', header: 'Joined', render: (w) => formatDate(w.createdAt) },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(w) => w.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyMessage="No workers match these filters."
      onRowClick={(w) => router.push(`/workers/${w.id}`)}
    />
  )
}