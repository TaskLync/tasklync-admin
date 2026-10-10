// app/(admin)/bookings/[bookingId]/page.tsx
'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useBookingDetail } from '@/hooks/useBookings'
import BookingHeader from '@/components/bookings/BookingHeader'
import BookingSummary from '@/components/bookings/BookingSummary'
import BookingStatusTimeline from '@/components/bookings/BookingStatusTimeline'
import BookingChat from '@/components/bookings/BookingChat'
import BookingLocation from '@/components/bookings/BookingLocation'
import BookingAdminActions from '@/components/bookings/BookingAdminActions'
import BookingParties from '@/components/bookings/BookingParties'
import BookingPayment from '@/components/bookings/BookingPayment'
import BookingNotes from '@/components/bookings/BookingNotes'

export default function BookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params)
  const { booking, isLoading, error, mutate } = useBookingDetail(bookingId)

  return (
    <div className="px-6 py-5">
      <Link
        href="/bookings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to Bookings
      </Link>

      <BookingHeader booking={booking} isLoading={isLoading} error={error} />

      {error && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
          {error.message === 'Booking not found' ? (
            "This booking doesn't exist."
          ) : (
            <>
              Couldn't load this booking.{' '}
              <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {booking && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <BookingSummary booking={booking} />
            <BookingStatusTimeline booking={booking} />
            <BookingChat booking={booking} />
            <BookingLocation booking={booking} />
          </div>
          <div className="flex flex-col gap-4">
            <BookingAdminActions booking={booking} />
            <BookingParties booking={booking} />
            <BookingPayment bookingId={booking.id} />
            <BookingNotes bookingId={booking.id} />
          </div>
        </div>
      )}
    </div>
  )
}