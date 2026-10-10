// components/bookings/BookingChat.tsx
'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useBookingChat } from '@/hooks/useBookings'
import { formatDateTime } from './booking-ui'
import type { BookingChatMessage, BookingDetail } from '@/types/booking'

function Bubble({ m, booking }: { m: BookingChatMessage; booking: BookingDetail }) {
  if (m.senderType === 'system' || m.type === 'system') {
    const event = typeof m.metadata?.event === 'string' ? m.metadata.event.replace(/_/g, ' ') : null
    return (
      <p className="text-center text-xs italic text-gray-400">
        {m.content ?? event ?? 'System message'} · {formatDateTime(m.createdAt)}
      </p>
    )
  }

  const isWorker = m.senderType === 'worker'
  const sender = isWorker ? (booking.worker.name ?? 'Worker') : (booking.user.name ?? 'Customer')

  return (
    <div className={cn('flex flex-col', isWorker ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isWorker ? 'bg-[#1F6F5F]/10 text-gray-900' : 'bg-gray-100 text-gray-900'
        )}
      >
        <p className="mb-0.5 text-[11px] font-medium text-gray-500">{sender}</p>

        {m.type === 'text' && <p className="whitespace-pre-wrap break-words">{m.content}</p>}

        {m.type === 'image' && m.mediaUrl && (
          <a href={m.mediaUrl} target="_blank" rel="noreferrer">
            <Image
              src={m.mediaThumbnailUrl ?? m.mediaUrl}
              alt="Shared photo"
              width={200}
              height={200}
              unoptimized
              className="h-40 w-40 rounded-md object-cover"
            />
          </a>
        )}

        {m.type === 'location' && m.metadata && (
          <a
            href={`https://www.google.com/maps?q=${m.metadata.lat},${m.metadata.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-[#1F6F5F] hover:underline"
          >
            Shared location ({String(m.metadata.lat)}, {String(m.metadata.lng)})
          </a>
        )}
      </div>
      <span className="mt-0.5 text-[11px] text-gray-400">{formatDateTime(m.createdAt)}</span>
    </div>
  )
}

export default function BookingChat({ booking }: { booking: BookingDetail }) {
  const { chat, isLoading, error, mutate } = useBookingChat(booking.id)

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Chat transcript
        </h2>
        {chat?.available && (
          <span className="text-xs text-gray-400">{chat.data.length} messages · read-only</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn('h-10 w-2/3 animate-pulse rounded-lg bg-gray-100', i % 2 && 'self-end')}
            />
          ))}
        </div>
      ) : error || !chat ? (
        <p className="text-sm text-gray-500">
          Couldn't load the chat transcript.{' '}
          <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">
            Retry
          </button>
        </p>
      ) : !chat.available ? (
        <p className="text-sm text-gray-500">
          The chat table isn't reachable from the admin panel yet.
        </p>
      ) : chat.data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No messages. A chat room is only created once the worker accepts the booking.
        </p>
      ) : (
        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
          {chat.data.map((m) => (
            <Bubble key={m.id} m={m} booking={booking} />
          ))}
        </div>
      )}
    </Card>
  )
}