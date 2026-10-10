// app/(admin)/disputes/page.tsx
import { Suspense } from 'react'
import DisputesSection from '@/components/disputes/DisputesSection'
import { DisputeKpiGrid } from '@/components/disputes/DisputeKpiGrid'

export const metadata = { title: 'Disputes & Refunds | Tasklync Admin' }

export default function DisputesPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Disputes &amp; Refunds</h1>
        <p className="text-sm text-gray-500">
          Review what both sides say, check the evidence, and decide where the money goes.
        </p>
      </div>
      <div className="mb-4">
        <DisputeKpiGrid />
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <DisputesSection />
      </Suspense>
    </div>
  )
}