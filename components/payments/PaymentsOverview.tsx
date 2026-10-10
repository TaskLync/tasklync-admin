// components/payments/PaymentsOverview.tsx
'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import type { PaymentTab } from '@/lib/payment-constants'
import { usePaymentOverview } from '@/hooks/usePayments'
import type { OverviewPeriod, PaymentOverview } from '@/types/payment'
import { PaymentKpiGrid } from './PaymentKpiGrid'
import PaymentRevenueChart from './PaymentRevenueChart'
import { formatPkr, methodLabel } from './payment-ui'

interface AttentionRow {
  key: string
  label: string
  tone: BadgeTone
  tab?: PaymentTab
  filters?: Record<string, string>
}

function attentionRows(a: PaymentOverview['attention']): AttentionRow[] {
  const rows: AttentionRow[] = []
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  if (a.failedPayments)
    rows.push({ key: 'fp', label: `${plural(a.failedPayments, 'failed payment')}`, tone: 'danger', tab: 'transactions', filters: { status: 'FAILED' } })
  if (a.failedPayouts)
    rows.push({ key: 'fo', label: `${plural(a.failedPayouts, 'failed worker payout')} awaiting retry`, tone: 'danger', tab: 'payouts', filters: { status: 'FAILED' } })
  if (a.failedRefunds)
    rows.push({ key: 'fr', label: `${plural(a.failedRefunds, 'failed refund')}`, tone: 'danger', tab: 'refunds', filters: { status: 'FAILED' } })
  if (a.stalePendingRefunds)
    rows.push({ key: 'sr', label: `${plural(a.stalePendingRefunds, 'refund')} pending for over 24h`, tone: 'warning', tab: 'refunds', filters: { status: 'PENDING' } })
  if (a.deadLetters7d)
    rows.push({ key: 'dl', label: `${plural(a.deadLetters7d, 'payout/refund job')} moved to dead_letters in the last 7 days`, tone: 'warning' })

  return rows
}

export default function PaymentsOverview({
  onOpen,
}: {
  onOpen: (tab: PaymentTab, filters?: Record<string, string>) => void
}) {
  const [period, setPeriod] = useState<OverviewPeriod>('mtd')
  const { overview, isLoading, error, mutate } = usePaymentOverview(period)

  const rows = overview ? attentionRows(overview.attention) : []
  const totalByMethod = overview?.byMethod.reduce((s, m) => s + m.gross, 0) ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Overview</h2>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-0.5">
          {(['mtd', 'ytd'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors duration-150',
                period === p ? 'bg-[#1F6F5F] text-white' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {p === 'mtd' ? 'This month' : 'This year'}
            </button>
          ))}
        </div>
      </div>

      <PaymentKpiGrid
        data={overview}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        period={period}
      />

      {overview && (
        <Card className="flex flex-wrap gap-x-8 gap-y-2 px-4 py-3 text-sm text-gray-600">
          <span>
            Worker wallets available:{' '}
            <strong className="text-gray-900">{formatPkr(overview.walletBalance)}</strong>
          </span>
          <span>
            Wallets pending release:{' '}
            <strong className="text-gray-900">{formatPkr(overview.walletPending)}</strong>
          </span>
          <span>
            Payouts in flight:{' '}
            <strong className="text-gray-900">{formatPkr(overview.payoutsInFlight)}</strong>
          </span>
          <span>
            Refunds in flight:{' '}
            <strong className="text-gray-900">{formatPkr(overview.refundsPending)}</strong>
          </span>
        </Card>
      )}

      <PaymentRevenueChart />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By method */}
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            By payment method
          </h2>
          {isLoading && !overview && <div className="h-28 animate-pulse rounded bg-gray-100" />}
          {overview && overview.byMethod.length === 0 && (
            <p className="py-4 text-sm text-gray-400">No completed bookings in this period.</p>
          )}
          {overview && overview.byMethod.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                  <th className="py-1.5 text-left font-medium">Method</th>
                  <th className="py-1.5 text-right font-medium">Bookings</th>
                  <th className="py-1.5 text-right font-medium">Gross</th>
                  <th className="py-1.5 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {overview.byMethod.map((m) => (
                  <tr key={m.method} className="even:bg-gray-50">
                    <td className="py-1.5 text-gray-800">{methodLabel(m.method)}</td>
                    <td className="py-1.5 text-right text-gray-500">{m.bookings}</td>
                    <td className="py-1.5 text-right text-gray-800">{formatPkr(m.gross)}</td>
                    <td className="py-1.5 text-right text-gray-500">
                      {totalByMethod ? Math.round((m.gross / totalByMethod) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Needs attention */}
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Needs attention
          </h2>
          {isLoading && !overview && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          )}
          {overview && rows.length === 0 && (
            <p className="py-4 text-sm text-gray-400">No failed payments, payouts or refunds.</p>
          )}
          {overview && rows.length > 0 && (
            <div className="flex flex-col divide-y divide-gray-100">
              {rows.map((row) => {
                const clickable = Boolean(row.tab)
                return (
                  <button
                    key={row.key}
                    disabled={!clickable}
                    onClick={() => row.tab && onOpen(row.tab, row.filters)}
                    className={cn(
                      'flex items-center justify-between py-2.5 text-left text-sm text-gray-800 transition-colors duration-150',
                      clickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
                    )}
                  >
                    <span>{row.label}</span>
                    <Badge tone={row.tone}>{row.tone === 'danger' ? 'Urgent' : 'Review'}</Badge>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}