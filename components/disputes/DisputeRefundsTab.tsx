// components/disputes/DisputeRefundsTab.tsx
'use client'

import Link from 'next/link'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { REFUND_REASONS, REFUND_STATUSES } from '@/lib/payment-constants'
import { useFilterState } from '@/hooks/usePayments'
import { DEFAULT_DISPUTE_REFUND_FILTERS, useDisputeRefunds } from '@/hooks/useDisputes'
import {
  REFUND_REASON_LABEL,
  REFUND_STATUS_LABEL,
  REFUND_STATUS_TONE,
  methodLabel,
} from '@/components/payments/payment-ui'
import type { RefundRow } from '@/types/payment'
import type { DisputeRefundFilters } from '@/types/dispute'
import { Field, Pager, Person, SELECT_CLASS, formatDateTime, formatPkr, shortId } from './dispute-ui'

export default function DisputeRefundsTab() {
  const { filters, update, reset } = useFilterState<DisputeRefundFilters>(
    DEFAULT_DISPUTE_REFUND_FILTERS
  )
  const { refunds, isLoading, error, mutate } = useDisputeRefunds(filters)

  const columns: DataTableColumn<RefundRow>[] = [
    { key: 'date', header: 'Date', render: (r) => formatDateTime(r.initiatedAt) },
    {
      key: 'booking',
      header: 'Booking',
      render: (r) => (
        <Link
          href={`/bookings/${r.bookingId}`}
          className="font-mono text-xs text-gray-700 hover:text-[#1F6F5F] hover:underline"
        >
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
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div className="leading-tight">
          <Badge tone={REFUND_STATUS_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Badge>
          {r.status === 'FAILED' && r.failureReason && (
            <span
              className="mt-0.5 block max-w-[200px] truncate text-[11px] text-red-600"
              title={r.failureReason}
            >
              {r.failureReason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Gateway ref',
      render: (r) => (
        <span className="font-mono text-[11px] text-gray-500">{r.gatewayReference ?? '—'}</span>
      ),
    },
    {
      key: 'by',
      header: 'Processed by',
      render: (r) => (r.initiatedBy === 'admin' ? (r.adminName ?? 'Admin') : 'System'),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Refunds {refunds ? `(${refunds.total.toLocaleString()})` : ''}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Read-only. Refunds are created by payment-service after a dispute decision or cancellation.
          Failed or stuck refunds need Finance: ask them to check Payments → Refunds.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
          <Input
            placeholder="Refund ID, booking ID, customer or phone"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        <Field label="Show">
          <select
            className={SELECT_CLASS}
            value={filters.source}
            onChange={(e) => update({ source: e.target.value as DisputeRefundFilters['source'] })}
          >
            <option value="dispute">Dispute refunds</option>
            <option value="everything">All refunds</option>
          </select>
        </Field>

        <Field label="Status">
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as DisputeRefundFilters['status'] })}
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
            onChange={(e) => update({ reason: e.target.value as DisputeRefundFilters['reason'] })}
          >
            <option value="all">All</option>
            {REFUND_REASONS.map((r) => (
              <option key={r} value={r}>
                {REFUND_REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="From">
          <Input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => update({ dateFrom: e.target.value || null })}
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => update({ dateTo: e.target.value || null })}
          />
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
        emptyMessage="No refunds yet. They appear here once payment-service processes a dispute decision."
        rowClassName={(r) =>
          r.status === 'FAILED' ? 'bg-red-50! even:bg-red-50! hover:bg-red-100!' : ''
        }
      />

      {refunds && (
        <Pager
          page={filters.page}
          pageSize={filters.pageSize}
          total={refunds.total}
          onPage={(page) => update({ page })}
        />
      )}
    </div>
  )
}