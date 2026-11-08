import { Suspense } from 'react'
import PromotionsSection from '@/components/promotions/PromotionsSection'

export const metadata = { title: 'Promotions | Tasklync Admin' }

export default function PromotionsPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Worker promotions</h1>
        <p className="text-sm text-gray-500">
          Offers created by workers and paid for by the worker. Platform campaigns are in Coupons.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <PromotionsSection />
      </Suspense>
    </div>
  )
}