// components/payments/ReportsTab.tsx
'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { usePermission } from '@/hooks/usePermission'
import type { ReportType } from '@/lib/payment-constants'
import { Field } from './payment-ui'

const REPORTS: { type: ReportType; title: string; description: string }[] = [
  {
    type: 'monthly-revenue',
    title: 'Monthly revenue report',
    description: 'Completed bookings per month: gross value, platform fees and worker amount.',
  },
  {
    type: 'payouts',
    title: 'Worker payout report',
    description: 'Every payout in the date range with status and gateway reference. Destinations are not exported.',
  },
  {
    type: 'tax-summary',
    title: 'Platform fee summary (FBR prep)',
    description:
      'Platform fees collected per month. Withholding-tax tracking is not built yet, so confirm what you must file with your accountant.',
  },
  {
    type: 'city-value',
    title: 'Booking value by city',
    description: 'Completed bookings, gross value and platform fees per city.',
  },
  {
    type: 'transactions',
    title: 'Full transaction ledger',
    description: 'Every online payment and completed COD booking in the range (up to 20,000 rows).',
  },
]

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export default function ReportsTab() {
  const canExport = usePermission('payments:export')
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 365 * 86_400_000)))
  const [to, setTo] = useState(() => isoDay(new Date()))

  if (!canExport) {
    return <p className="text-sm text-gray-500">You don't have permission to export reports.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <p className="pb-2 text-xs text-gray-400">
          Revenue reports use the booking completion date. Payout reports use the initiated date.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.type} className="flex flex-col justify-between gap-3 p-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{r.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{r.description}</p>
            </div>
            <div>
              <a
                href={`/api/admin/payments/reports?type=${r.type}&dateFrom=${from}&dateTo=${to}`}
                className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Download CSV
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}