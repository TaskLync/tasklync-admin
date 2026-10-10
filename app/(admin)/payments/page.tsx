// app/(admin)/payments/page.tsx
import { Suspense } from 'react'
import PaymentsSection from '@/components/payments/PaymentsSection'

export const metadata = { title: 'Payments & Finance | Tasklync Admin' }

export default function PaymentsPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Payments &amp; Finance</h1>
        <p className="text-sm text-gray-500">
          Revenue, escrow, worker payouts and refunds across COD and online payments.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <PaymentsSection />
      </Suspense>
    </div>
  )
}