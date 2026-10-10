// components/payments/RefundsTab.tsx
'use client'

import Link from 'next/link'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { REFUND_REASONS, REFUND_STATUSES } from '@/lib/payment-constants'
import { DEFAULT_REFUND_FILTERS, useFilterState, useRefunds } from '@/hooks/usePayments'
import type { RefundFilters, RefundRow } from '@/types/payment'
import {
  Field,
  Pager,
  Person,
  REFUND_REASON_LABEL,
  REFUND_STATUS_LABEL,
  REFUND_STATUS_TONE,
  SELECT_CLASS,
  formatDateTime,
  formatPkr,
  methodLabel,
  shortId,
} from './payment-ui'

export default function RefundsTab({ initial }: { initial?: Partial<RefundFilters> }) {
  const { filters, update, reset } = useFilterState(DEFAULT_REFUND_FILTERS, initial)
  const { refunds, isLoading, error, mutate } = useRefunds(filters)

  const columns: DataTableColumn<RefundRow>[] = [
    { key: 'date', header: 'Date', render: (r) => formatDateTime(r.initiatedAt) },
    {
      key: 'booking',
      header: 'Booking',
      render: (r) => (
        <Link href={`/bookings/${r.bookingId}`} className="font-mono text-xs text-gray-700 hover:text-[#1F6F5F] hover:underline">
          {shortId(r.bookingId)}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', render: (r) => <Person name={r.userName} phone={r.userPhone} /> },
    { key: 'reason', header: 'Reason', render: (r) => REFUND_REASON_LABEL[r.reason] ?? r.reason },
    {
      key: 'amount',
      header: 'Refund',
      render: (r) => (
        <span>
          {formatPkr(r.amount)} <span className="text-xs text-gray-400">({r.percentage}%)</span>
        </span>
      ),
    },
    { key: 'method', header: 'Back to', render: (r) => methodLabel(r.method) },
    {
      key: 'destination',
      header: 'Destination',
      render: (r) => <span className="font-mono text-xs text-gray-500">{r.destination}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div className="leading-tight">
          <Badge tone={REFUND_STATUS_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Badge>
          {r.status === 'FAILED' && r.failureReason && (
            <span className="mt-0.5 block max-w-[200px] truncate text-[11px] text-red-600" title={r.failureReason}>
              {r.failureReason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Gateway ref',
      render: (r) => <span className="font-mono text-[11px] text-gray-500">{r.gatewayReference ?? '—'}</span>,
    },
    {
      key: 'by',
      header: 'Processed by',
      render: (r) => (r.initiatedBy === 'admin' ? (r.adminName ?? 'Admin') : 'System'),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Refunds {refunds ? `(${refunds.total.toLocaleString()})` : ''}
      </h2>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
          <Input
            placeholder="Refund ID, booking ID, customer or phone"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        <Field label="Status">
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as RefundFilters['status'] })}
          >
            <option value="all">All</option>
            {REFUND_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REFUND_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reason">
          <select
            className={SELECT_CLASS}
            value={filters.reason}
            onChange={(e) => update({ reason: e.target.value as RefundFilters['reason'] })}
          >
            <option value="all">All</option>
            {REFUND_REASONS.map((r) => (
              <option key={r} value={r}>
                {REFUND_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Initiated by">
          <select
            className={SELECT_CLASS}
            value={filters.initiatedBy}
            onChange={(e) => update({ initiatedBy: e.target.value as RefundFilters['initiatedBy'] })}
          >
            <option value="all">Anyone</option>
            <option value="admin">Admin</option>
            <option value="system">System</option>
          </select>
        </Field>

        <Field label="From">
          <Input type="date" value={filters.dateFrom ?? ''} onChange={(e) => update({ dateFrom: e.target.value || null })} />
        </Field>
        <Field label="To">
          <Input type="date" value={filters.dateTo ?? ''} onChange={(e) => update({ dateTo: e.target.value || null })} />
        </Field>

        <button onClick={reset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">
          Clear filters
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={refunds?.data ?? []}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyMessage="No refunds yet. To refund a payment, use the Refund button in Transactions."
        rowClassName={(r) => (r.status === 'FAILED' ? 'bg-red-50! even:bg-red-50! hover:bg-red-100!' : '')}
      />

      {refunds && (
        <Pager page={filters.page} pageSize={filters.pageSize} total={refunds.total} onPage={(page) => update({ page })} />
      )}
    </div>
  )
}