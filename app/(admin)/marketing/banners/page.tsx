import { Suspense } from 'react'
import BannersSection from '@/components/banners/BannersSection'

export const metadata = { title: 'Promo Banners | Tasklync Admin' }

export default function BannersPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Marketing & Promotions</p>
        <h1 className="text-lg font-semibold text-gray-900">Banner Management</h1>
        <p className="text-sm text-gray-500">
          Promotional banners on the customer app home screen. Changes reach the app within a minute, no app update needed.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <BannersSection />
      </Suspense>
    </div>
  )
}
