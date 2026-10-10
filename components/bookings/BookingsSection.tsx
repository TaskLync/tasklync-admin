// components/bookings/BookingsSection.tsx
'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'
import { BOOKING_STATUSES, type BookingStatus } from '@/lib/booking-constants'
import {
  buildBookingExportQuery,
  useBookingBoard,
  useBookingFilters,
  useBookingsList,
} from '@/hooks/useBookings'
import { useWorkerFilterOptions } from '@/hooks/useWorkers'
import BookingBoard from './BookingBoard'
import BookingFilterBar from './BookingFilterBar'
import BookingTable from './BookingTable'

const KNOWN_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi']

type View = 'board' | 'table'

export default function BookingsSection() {
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status')
  const validStatus = (BOOKING_STATUSES as readonly string[]).includes(statusParam ?? '')

  // A status deep link (e.g. from the dashboard) opens the table, already filtered.
  const [view, setView] = useState<View>(validStatus ? 'table' : 'board')
  const { filters, update, reset } = useBookingFilters(
    validStatus ? { status: statusParam as BookingStatus } : {}
  )
  const { categories } = useWorkerFilterOptions()

  const isTable = view === 'table'
  const list = useBookingsList(filters, isTable)
  const board = useBookingBoard(filters, !isTable)

  const totalPages = list.bookings?.totalPages ?? 1

  const pageSummary = useMemo(() => {
    const b = list.bookings
    if (!b) return ''
    const start = (b.page - 1) * b.pageSize + 1
    const end = Math.min(b.page * b.pageSize, b.total)
    return `${start}–${end} of ${b.total}`
  }, [list.bookings])

  const exportHref = `/api/admin/bookings/export?${buildBookingExportQuery(filters)}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {isTable
            ? `Bookings ${list.bookings ? `(${list.bookings.total.toLocaleString()})` : ''}`
            : 'Booking pipeline'}
        </h2>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-300 bg-white p-0.5">
            {(['board', 'table'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'h-8 rounded px-3 text-sm transition-colors duration-150',
                  view === v
                    ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {v === 'board' ? 'Kanban' : 'Table'}
              </button>
            ))}
          </div>

          <a
            href={exportHref}
            className="flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </a>
        </div>
      </div>

      <BookingFilterBar
        filters={filters}
        onChange={update}
        onReset={reset}
        cities={KNOWN_CITIES}
        categories={categories}
        hideStatus={!isTable}
      />

      {isTable ? (
        <>
          <BookingTable
            rows={list.bookings?.data ?? []}
            isLoading={list.isLoading}
            error={list.error}
            onRetry={() => list.mutate()}
          />

          {list.bookings && list.bookings.total > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{pageSummary}</span>
              <div className="flex gap-2">
                <button
                  className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
                  disabled={filters.page <= 1}
                  onClick={() => update({ page: filters.page - 1 })}
                >
                  Previous
                </button>
                <button
                  className="h-9 rounded-md border border-gray-300 px-3 disabled:opacity-40"
                  disabled={filters.page >= totalPages}
                  onClick={() => update({ page: filters.page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <BookingBoard
          board={board.board}
          isLoading={board.isLoading}
          error={board.error}
          onRetry={() => board.mutate()}
        />
      )}
    </div>
  )
}