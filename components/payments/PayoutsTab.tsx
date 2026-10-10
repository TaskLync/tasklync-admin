// components/payments/PayoutsTab.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PAYMENT_METHODS, PAYOUT_STATUSES } from '@/lib/payment-constants'
import { usePermission } from '@/hooks/usePermission'
import {
  DEFAULT_PAYOUT_FILTERS,
  paymentActions,
  useFilterState,
  usePayouts,
} from '@/hooks/usePayments'
import type { PayoutFilters, PayoutRow } from '@/types/payment'
import {
  Field,
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_TONE,
  Pager,
  Person,
  SELECT_CLASS,
  formatDateTime,
  formatPkr,
  methodLabel,
  shortId,
} from './payment-ui'

export default function PayoutsTab({ initial }: { initial?: Partial<PayoutFilters> }) {
  const { mutate: globalMutate } = useSWRConfig()
  const { filters, update, reset } = useFilterState(DEFAULT_PAYOUT_FILTERS, initial)
  const { payouts, isLoading, error, mutate } = usePayouts(filters)
  const canRetry = usePermission('payments:payout')
  const [retryRow, setRetryRow] = useState<PayoutRow | null>(null)

  const columns: DataTableColumn<PayoutRow>[] = [
    { key: 'initiated', header: 'Initiated', render: (p) => formatDateTime(p.initiatedAt) },
    {
      key: 'worker',
      header: 'Worker',
      render: (p) => (
        <Link href={`/workers/${p.workerId}`} className="hover:text-[#1F6F5F] hover:underline">
          <Person name={p.workerName} phone={p.workerPhone} />
        </Link>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (p) =>
        p.bookingId ? (
          <Link href={`/bookings/${p.bookingId}`} className="font-mono text-xs text-gray-700 hover:text-[#1F6F5F] hover:underline">
            {shortId(p.bookingId)}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'amount', header: 'Amount', render: (p) => formatPkr(p.amount, p.currency) },
    { key: 'method', header: 'Method', render: (p) => methodLabel(p.method) },
    {
      key: 'destination',
      header: 'Destination',
      render: (p) => <span className="font-mono text-xs text-gray-500">{p.destination}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div className="leading-tight">
          <Badge tone={PAYOUT_STATUS_TONE[p.status]}>{PAYOUT_STATUS_LABEL[p.status]}</Badge>
          {p.status === 'FAILED' && p.failureReason && (
            <span className="mt-0.5 block max-w-[200px] truncate text-[11px] text-red-600" title={p.failureReason}>
              {p.failureReason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Gateway ref',
      render: (p) => <span className="font-mono text-[11px] text-gray-500">{p.gatewayReference ?? '—'}</span>,
    },
    { key: 'completed', header: 'Completed', render: (p) => formatDateTime(p.completedAt) },
    {
      key: 'actions',
      header: '',
      render: (p) =>
        canRetry && p.status === 'FAILED' ? (
          <Button size="sm" variant="secondary" onClick={() => setRetryRow(p)}>
            Retry payout
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Worker payouts {payouts ? `(${payouts.total.toLocaleString()})` : ''}
      </h2>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
          <Input
            placeholder="Worker, phone, booking ID or gateway ref"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        <Field label="Status">
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as PayoutFilters['status'] })}
          >
            <option value="all">All</option>
            {PAYOUT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYOUT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Method">
          <select className={SELECT_CLASS} value={filters.method} onChange={(e) => update({ method: e.target.value })}>
            <option value="all">All</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
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
        rows={payouts?.data ?? []}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyMessage="No payouts yet. Workers on COD keep the cash, so payouts only appear once online payments are enabled."
        rowClassName={(p) => (p.status === 'FAILED' ? 'bg-red-50! even:bg-red-50! hover:bg-red-100!' : '')}
      />

      {payouts && (
        <Pager page={filters.page} pageSize={filters.pageSize} total={payouts.total} onPage={(page) => update({ page })} />
      )}

      {retryRow && (
        <ConfirmDialog
          open
          title="Retry this payout?"
          description={`${formatPkr(retryRow.amount, retryRow.currency)} to ${retryRow.workerName ?? 'the worker'} via ${methodLabel(retryRow.method)} (${retryRow.destination}). Check the failure reason first. A wrong number or IBAN will just fail again.`}
          confirmLabel="Retry payout"
          destructive={false}
          onClose={() => setRetryRow(null)}
          onConfirm={async () => {
            await paymentActions.retryPayout(retryRow.id)
            toast.success('Payout re-queued')
            globalMutate((key) => typeof key === 'string' && key.startsWith('/api/admin/payments'))
          }}
        />
      )}
    </div>
  )
}