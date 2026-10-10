// components/verification/VerificationTable.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { formatDate, initial } from '@/components/workers/worker-ui'
import { rejectionLabel } from '@/lib/verification-constants'
import {
  SLA_ROW_CLASS,
  SLA_TONE,
  formatWaiting,
  slaLevel,
} from './verification-ui'
import type { QueueTab, VerificationQueueItem } from '@/types/verification'

interface Props {
  tab: QueueTab
  rows: VerificationQueueItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

const EMPTY: Record<QueueTab, string> = {
  pending: 'Nothing waiting for review. Nice work.',
  resubmitted: 'No re-submitted applications right now.',
  approved: 'No workers approved in the last 30 days.',
  rejected: 'No workers rejected in the last 30 days.',
}

export default function VerificationTable({ tab, rows, isLoading, error, onRetry }: Props) {
  const router = useRouter()
  const isPendingTab = tab === 'pending' || tab === 'resubmitted'

  const baseColumns: DataTableColumn<VerificationQueueItem>[] = [
    {
      key: 'name',
      header: 'Worker',
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
          {isPendingTab && w.lastDecision === 'info_requested' && (
            <Badge tone="info">Info requested</Badge>
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
  ]

  const pendingColumns: DataTableColumn<VerificationQueueItem>[] = [
    { key: 'submitted', header: 'Submitted', render: (w) => formatDate(w.submittedAt) },
    {
      key: 'waiting',
      header: 'Days waiting',
      render: (w) => (
        <Badge tone={SLA_TONE[slaLevel(w.submittedAt)]}>{formatWaiting(w.submittedAt)}</Badge>
      ),
    },
    { key: 'docs', header: 'Pending docs', render: (w) => `${w.pendingDocs} / ${w.totalDocs}` },
  ]

  const decidedColumns: DataTableColumn<VerificationQueueItem>[] = [
    { key: 'decided', header: 'Decided', render: (w) => formatDate(w.lastDecisionAt) },
    { key: 'by', header: 'By', render: (w) => w.lastAdminEmail ?? '—', className: 'text-xs' },
    ...(tab === 'rejected'
      ? [
          {
            key: 'reason',
            header: 'Reason',
            render: (w: VerificationQueueItem) => rejectionLabel(w.lastReasonCode),
          },
        ]
      : []),
  ]

  const actionColumn: DataTableColumn<VerificationQueueItem> = {
    key: 'action',
    header: '',
    className: 'text-right',
    render: (w) => (
      <Link
        href={`/workers/verification/${w.id}`}
        onClick={(e) => e.stopPropagation()}
        className={
          isPendingTab
            ? 'inline-flex h-8 items-center rounded-md bg-[#1F6F5F] px-2.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#195c4f]'
            : 'inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50'
        }
      >
        {isPendingTab ? 'Review' : 'View'}
      </Link>
    ),
  }

  const columns = [
    ...baseColumns,
    ...(isPendingTab ? pendingColumns : decidedColumns),
    actionColumn,
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(w) => w.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyMessage={EMPTY[tab]}
      onRowClick={(w) => router.push(`/workers/verification/${w.id}`)}
      rowClassName={(w) => (isPendingTab ? SLA_ROW_CLASS[slaLevel(w.submittedAt)] : '')}
    />
  )
}