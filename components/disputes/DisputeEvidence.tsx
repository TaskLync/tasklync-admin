// components/disputes/DisputeEvidence.tsx  (spec 7.2b: chat, location, status history)
'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useBookingDetail } from '@/hooks/useBookings'
import BookingChat from '@/components/bookings/BookingChat'
import BookingLocation from '@/components/bookings/BookingLocation'
import BookingStatusTimeline from '@/components/bookings/BookingStatusTimeline'

type EvidenceTab = 'chat' | 'location' | 'history'

const TABS: { key: EvidenceTab; label: string; hint: string }[] = [
  {
    key: 'chat',
    label: 'Chat transcript',
    hint: 'Read-only. Look for photos, agreements on price or scope, and anything said after the job.',
  },
  {
    key: 'location',
    label: 'Location & GPS',
    hint: "Did the worker actually reach the job site? Compare the trail with the job site marker.",
  },
  {
    key: 'history',
    label: 'Status history',
    hint: 'Who moved the booking through each state, and when. Admin changes are labelled.',
  },
]

export default function DisputeEvidence({ bookingId }: { bookingId: string }) {
  const [tab, setTab] = useState<EvidenceTab>('chat')
  const { booking, isLoading, error, mutate } = useBookingDetail(bookingId)
  const active = TABS.find((t) => t.key === tab)!

  return (
    <div className="flex flex-col gap-3">
      <Card className="px-4 pt-3">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Evidence
        </h2>
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm transition-colors duration-150',
                tab === t.key
                  ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="py-2 text-xs text-gray-500">{active.hint}</p>
      </Card>

      {isLoading && !booking && <div className="h-48 animate-pulse rounded-lg bg-gray-100" />}

      {error && !booking && (
        <Card className="p-4 text-sm text-gray-500">
          Couldn't load the booking evidence.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </Card>
      )}

      {booking && tab === 'chat' && <BookingChat booking={booking} />}
      {booking && tab === 'location' && <BookingLocation booking={booking} />}
      {booking && tab === 'history' && <BookingStatusTimeline booking={booking} />}
    </div>
  )
}