// components/disputes/DisputeTable.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import type { DisputeTab } from '@/lib/dispute-constants'
import type { DisputeListItem } from '@/types/dispute'
import {
  Person,
  RESOLUTION_LABEL,
  RESOLUTION_TONE,
  SLA_ROW_CLASS,
  SLA_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  formatAge,
  formatDateTime,
  formatPkr,
  shortId,
  slaLevel,
} from './dispute-ui'

interface Props {
  tab: DisputeTab
  rows: DisputeListItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

const EMPTY: Record<DisputeTab, string> = {
  open: 'No disputes waiting for a decision. Nice work.',
  awaiting: 'No disputes waiting on a worker response.',
  escalated: 'Nothing escalated to a Super Admin.',
  resolved: 'No disputes resolved in the last 30 days.',
}

export default function DisputeTable({ tab, rows, isLoading, error, onRetry }: Props) {
  const router = useRouter()
  const isResolvedTab = tab === 'resolved'

  const baseColumns: DataTableColumn<DisputeListItem>[] = [
    {
      key: 'dispute',
      header: 'Dispute',
      render: (d) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-gray-700">{shortId(d.id)}</span>
          {d.openedByAdmin && <Badge tone="info">Admin-opened</Badge>}
          {d.isEscalated && !isResolvedTab && <Badge tone="danger">Escalated</Badge>}
        </div>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (d) => (
        <Link
          href={`/bookings/${d.bookingId}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-gray-700 hover:text-[#1F6F5F] hover:underline"
        >
          {shortId(d.bookingId)}
        </Link>
      ),
    },
    { key: 'customer', header: 'Raised by', render: (d) => <Person name={d.userName} phone={d.userPhone} /> },
    { key: 'worker', header: 'Against', render: (d) => <Person name={d.workerName} phone={d.workerPhone} /> },
    {
      key: 'category',
      header: 'Category',
      render: (d) => (
        <div className="leading-tight">
          <span>{d.categoryName ?? d.categoryId}</span>
          {d.city && <span className="block text-[11px] text-gray-400">{d.city}</span>}
        </div>
      ),
    },
    { key: 'amount', header: 'At stake', render: (d) => formatPkr(d.amount, d.currency) },
    { key: 'opened', header: 'Opened', render: (d) => formatDateTime(d.createdAt) },
  ]

  const activeColumns: DataTableColumn<DisputeListItem>[] = [
    {
      key: 'age',
      header: 'Age',
      render: (d) => <Badge tone={SLA_TONE[slaLevel(d.createdAt)]}>{formatAge(d.createdAt)}</Badge>,
    },
    {
      key: 'assigned',
      header: 'Assigned',
      render: (d) =>
        d.assignedToName ? (
          <span className="text-gray-800">{d.assignedToName}</span>
        ) : (
          <span className="text-gray-400">Unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
          {d.evidenceCount > 0 && (
            <span className="text-[11px] text-gray-400">{d.evidenceCount} file(s)</span>
          )}
        </div>
      ),
    },
  ]

  const resolvedColumns: DataTableColumn<DisputeListItem>[] = [
    { key: 'resolved', header: 'Resolved', render: (d) => formatDateTime(d.resolvedAt) },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (d) =>
        d.resolution ? (
          <Badge tone={RESOLUTION_TONE[d.resolution]}>{RESOLUTION_LABEL[d.resolution]}</Badge>
        ) : (
          <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
        ),
    },
    {
      key: 'refund',
      header: 'Refunded',
      render: (d) => (d.refundAmount && d.refundAmount > 0 ? formatPkr(d.refundAmount, d.currency) : '—'),
    },
    {
      key: 'assigned',
      header: 'Handled by',
      render: (d) => d.assignedToName ?? '—',
    },
  ]

  const actionColumn: DataTableColumn<DisputeListItem> = {
    key: 'action',
    header: '',
    className: 'text-right',
    render: (d) => (
      <Link
        href={`/disputes/${d.id}`}
        onClick={(e) => e.stopPropagation()}
        className={
          isResolvedTab
            ? 'inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50'
            : 'inline-flex h-8 items-center rounded-md bg-[#1F6F5F] px-2.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#195c4f]'
        }
      >
        {isResolvedTab ? 'View' : 'Review'}
      </Link>
    ),
  }

  const columns = [...baseColumns, ...(isResolvedTab ? resolvedColumns : activeColumns), actionColumn]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(d) => d.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyMessage={EMPTY[tab]}
      onRowClick={(d) => router.push(`/disputes/${d.id}`)}
      rowClassName={(d) => (isResolvedTab ? '' : SLA_ROW_CLASS[slaLevel(d.createdAt)])}
    />
  )
}