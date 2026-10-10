// components/bookings/BookingTable.tsx
'use client'

import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { STATUS_LABEL } from '@/lib/booking-constants'
import {
  PAYMENT_LABEL,
  PAYMENT_TONE,
  STATUS_TONE,
  STUCK_LABEL,
  STUCK_ROW_CLASS,
  STUCK_TONE,
  formatDateTime,
  formatPkr,
  shortId,
  stuckLevel,
} from './booking-ui'
import type { BookingListItem } from '@/types/booking'

interface Props {
  rows: BookingListItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

function Person({ name, phone }: { name: string | null; phone: string | null }) {
  return (
    <div className="leading-tight">
      <span className="font-medium text-gray-900">{name ?? 'Unknown'}</span>
      {phone && <span className="block font-mono text-[11px] text-gray-400">{phone}</span>}
    </div>
  )
}

export default function BookingTable({ rows, isLoading, error, onRetry }: Props) {
  const router = useRouter()

  const columns: DataTableColumn<BookingListItem>[] = [
    {
      key: 'id',
      header: 'Booking',
      render: (b) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-700">{shortId(b.id)}</span>
          {b.isUrgent && <Badge tone="danger">Urgent</Badge>}
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (b) => <Person name={b.userName} phone={b.userPhone} /> },
    { key: 'worker', header: 'Worker', render: (b) => <Person name={b.workerName} phone={b.workerPhone} /> },
    { key: 'category', header: 'Category', render: (b) => b.categoryName ?? b.categoryId },
    { key: 'city', header: 'City', render: (b) => b.city ?? '—' },
    { key: 'scheduled', header: 'Scheduled', render: (b) => formatDateTime(b.scheduledAt) },
    { key: 'amount', header: 'Amount', render: (b) => formatPkr(b.amount, b.currency) },
    {
      key: 'status',
      header: 'Status',
      render: (b) => {
        const level = stuckLevel(b)
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
            {level !== 'ok' && <Badge tone={STUCK_TONE[level]}>{STUCK_LABEL[level]}</Badge>}
            {b.hasDispute && <Badge tone="danger">Dispute</Badge>}
          </div>
        )
      },
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (b) => <Badge tone={PAYMENT_TONE[b.paymentStatus]}>{PAYMENT_LABEL[b.paymentStatus]}</Badge>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(b) => b.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyMessage="No bookings match these filters."
      onRowClick={(b) => router.push(`/bookings/${b.id}`)}
      rowClassName={(b) => STUCK_ROW_CLASS[stuckLevel(b)]}
    />
  )
}