import { Suspense } from 'react'
import CouponsSection from '@/components/coupons/CouponsSection'

export const metadata = { title: 'Coupons | Tasklync Admin' }

export default function CouponsPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Coupons</h1>
        <p className="text-sm text-gray-500">Platform-funded discount codes. Workers are always paid in full.</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <CouponsSection />
      </Suspense>
    </div>
  )
}