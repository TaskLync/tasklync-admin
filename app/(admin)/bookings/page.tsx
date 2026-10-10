// app/(admin)/bookings/page.tsx
import { Suspense } from 'react'
import BookingsSection from '@/components/bookings/BookingsSection'
import { BookingKpiGrid } from '@/components/bookings/BookingKpiGrid'

export const metadata = { title: 'Bookings | Tasklync Admin' }

export default function BookingsPage() {
  return (
    <div className="px-6 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-500">
          Track every booking through its lifecycle, step in when something gets stuck.
        </p>
      </div>
      <div className="mb-4">
        <BookingKpiGrid />
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-100" />}>
        <BookingsSection />
      </Suspense>
    </div>
  )
}