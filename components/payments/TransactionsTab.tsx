// components/payments/TransactionsTab.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LEDGER_METHODS, LEDGER_STATUSES } from '@/lib/payment-constants'
import { usePermission } from '@/hooks/usePermission'
import {
  DEFAULT_TRANSACTION_FILTERS,
  buildExportQuery,
  useFilterState,
  useTransactions,
} from '@/hooks/usePayments'
import type { TransactionFilters, TransactionRow } from '@/types/payment'
import RefundDialog from './RefundDialog'
import {
  Field,
  KNOWN_CITIES,
  LEDGER_STATUS_LABEL,
  LEDGER_STATUS_TONE,
  Pager,
  Person,
  SELECT_CLASS,
  formatDateTime,
  formatPkr,
  methodLabel,
  shortId,
} from './payment-ui'

export default function TransactionsTab({ initial }: { initial?: Partial<TransactionFilters> }) {
  const router = useRouter()
  const { mutate: globalMutate } = useSWRConfig()
  const { filters, update, reset } = useFilterState(DEFAULT_TRANSACTION_FILTERS, initial)
  const { transactions, isLoading, error, mutate } = useTransactions(filters)
  const canRefund = usePermission('payments:refund')
  const canExport = usePermission('payments:export')
  const [refundRow, setRefundRow] = useState<TransactionRow | null>(null)

  const exportHref = `/api/admin/payments/reports?type=transactions&${buildExportQuery(filters)}`

  const columns: DataTableColumn<TransactionRow>[] = [
    { key: 'date', header: 'Date', render: (t) => formatDateTime(t.txnAt) },
    {
      key: 'booking',
      header: 'Booking',
      render: (t) => <span className="font-mono text-xs text-gray-700">{shortId(t.bookingId)}</span>,
    },
    { key: 'customer', header: 'Customer', render: (t) => <Person name={t.userName} phone={t.userPhone} /> },
    { key: 'worker', header: 'Worker', render: (t) => <Person name={t.workerName} phone={t.workerPhone} /> },
    { key: 'gross', header: 'Gross', render: (t) => formatPkr(t.gross, t.currency) },
    { key: 'fee', header: 'Platform fee', render: (t) => formatPkr(t.platformFee, t.currency) },
    { key: 'worker_amt', header: 'Worker amount', render: (t) => formatPkr(t.workerAmount, t.currency) },
    { key: 'method', header: 'Method', render: (t) => methodLabel(t.method) },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <div className="leading-tight">
          <Badge tone={LEDGER_STATUS_TONE[t.status]}>{LEDGER_STATUS_LABEL[t.status]}</Badge>
          {t.status === 'FAILED' && t.failureReason && (
            <span className="mt-0.5 block max-w-[180px] truncate text-[11px] text-red-600" title={t.failureReason}>
              {t.failureReason}
            </span>
          )}
          {t.refunded > 0 && (
            <span className="mt-0.5 block text-[11px] text-gray-400">
              − {formatPkr(t.refunded, t.currency)} refunded
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'gateway',
      header: 'Gateway ref',
      render: (t) => {
        const ref = t.gatewayTransactionId ?? t.gatewayOrderId
        return ref ? (
          <span className="font-mono text-[11px] text-gray-500" title={ref}>
            {ref.length > 16 ? `${ref.slice(0, 16)}…` : ref}
          </span>
        ) : (
          '—'
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (t) =>
        canRefund && t.paymentId && t.refundable > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              setRefundRow(t)
            }}
          >
            Refund
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Transactions {transactions ? `(${transactions.total.toLocaleString()})` : ''}
        </h2>
        {canExport && (
          <a
            href={exportHref}
            className="flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
          <Input
            placeholder="Booking ID, customer, worker, phone or gateway ref"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        <Field label="Status">
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as TransactionFilters['status'] })}
          >
            <option value="all">All</option>
            {LEDGER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEDGER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Method">
          <select
            className={SELECT_CLASS}
            value={filters.method}
            onChange={(e) => update({ method: e.target.value as TransactionFilters['method'] })}
          >
            <option value="all">All</option>
            {LEDGER_METHODS.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="City">
          <select className={SELECT_CLASS} value={filters.city} onChange={(e) => update({ city: e.target.value })}>
            <option value="all">All cities</option>
            {KNOWN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Min amount (PKR)">
          <Input type="number" min={0} className="w-28" value={filters.amountMin} onChange={(e) => update({ amountMin: e.target.value })} />
        </Field>
        <Field label="Max amount (PKR)">
          <Input type="number" min={0} className="w-28" value={filters.amountMax} onChange={(e) => update({ amountMax: e.target.value })} />
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

      {transactions && transactions.total > 0 && (
        <p className="text-xs text-gray-500">
          Filtered total: gross <strong className="text-gray-800">{formatPkr(transactions.totals.gross)}</strong>
          {' · '}platform fees <strong className="text-gray-800">{formatPkr(transactions.totals.platformFee)}</strong>
          {' · '}worker amount <strong className="text-gray-800">{formatPkr(transactions.totals.workerAmount)}</strong>
        </p>
      )}

      <DataTable
        columns={columns}
        rows={transactions?.data ?? []}
        rowKey={(t) => t.paymentId ?? t.bookingId}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyMessage="No transactions match these filters."
        onRowClick={(t) => router.push(`/bookings/${t.bookingId}`)}
        rowClassName={(t) => (t.status === 'FAILED' ? 'bg-red-50! even:bg-red-50! hover:bg-red-100!' : '')}
      />

      {transactions && (
        <Pager
          page={filters.page}
          pageSize={filters.pageSize}
          total={transactions.total}
          onPage={(page) => update({ page })}
        />
      )}

      {refundRow && (
        <RefundDialog
          row={refundRow}
          onClose={() => setRefundRow(null)}
          onDone={() => {
            toast.success('Refund queued. payment-service will send it to the customer.')
            globalMutate((key) => typeof key === 'string' && key.startsWith('/api/admin/payments'))
          }}
        />
      )}
    </div>
  )
}