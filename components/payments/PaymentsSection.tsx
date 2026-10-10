// components/payments/PaymentsSection.tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'
import { LEDGER_STATUSES, PAYMENT_TABS, type PaymentTab } from '@/lib/payment-constants'
import PaymentsOverview from './PaymentsOverview'
import TransactionsTab from './TransactionsTab'
import PayoutsTab from './PayoutsTab'
import RefundsTab from './RefundsTab'
import ReportsTab from './ReportsTab'
import type { PayoutFilters, RefundFilters, TransactionFilters } from '@/types/payment'

const TAB_LABEL: Record<PaymentTab, string> = {
  overview: 'Overview',
  transactions: 'Transactions',
  payouts: 'Worker payouts',
  refunds: 'Refunds',
  reports: 'Reports',
}

const TAB_HINT: Record<PaymentTab, string> = {
  overview: 'Completed-booking revenue, escrow, wallets and anything that needs finance attention.',
  transactions: 'Every online payment plus completed COD bookings. Click a row to open the booking.',
  payouts: 'Money sent to workers (JazzCash, Easypaisa, Raast). Failed payouts can be retried.',
  refunds: 'Every refund, whether automatic (cancellations, disputes) or issued by an admin.',
  reports: 'CSV exports for accounting and FBR preparation.',
}

export default function PaymentsSection() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const statusParam = (searchParams.get('status') ?? '').toUpperCase()

  const validTab = (PAYMENT_TABS as readonly string[]).includes(tabParam ?? '')
  const validStatus = (LEDGER_STATUSES as readonly string[]).includes(statusParam)

  // A status deep link (e.g. /payments?status=failed from the dashboard) opens the ledger, filtered.
  const [tab, setTab] = useState<PaymentTab>(
    validTab ? (tabParam as PaymentTab) : validStatus ? 'transactions' : 'overview'
  )
  const [seed, setSeed] = useState<Record<string, string>>(
    validStatus && (!validTab || tabParam === 'transactions') ? { status: statusParam } : {}
  )

  function go(next: PaymentTab, filters: Record<string, string> = {}) {
    setSeed(filters)
    setTab(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {PAYMENT_TABS.map((t) => (
            <button
              key={t}
              onClick={() => go(t)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm transition-colors duration-150',
                tab === t
                  ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{TAB_HINT[tab]}</p>
      </div>

      {tab === 'overview' && <PaymentsOverview onOpen={go} />}
      {tab === 'transactions' && <TransactionsTab initial={seed as Partial<TransactionFilters>} />}
      {tab === 'payouts' && <PayoutsTab initial={seed as Partial<PayoutFilters>} />}
      {tab === 'refunds' && <RefundsTab initial={seed as Partial<RefundFilters>} />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  )
}