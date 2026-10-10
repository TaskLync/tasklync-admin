// components/bookings/BookingBoard.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import {
  BOARD_COLUMNS,
  BOARD_COLUMN_HINT,
  BOARD_COLUMN_LABEL,
  STATUS_LABEL,
  type BoardColumn,
} from '@/lib/booking-constants'
import {
  PAYMENT_LABEL,
  PAYMENT_TONE,
  STATUS_TONE,
  STUCK_BORDER_CLASS,
  STUCK_LABEL,
  STUCK_TONE,
  formatPkr,
  shortId,
  stuckLevel,
  timeAgo,
} from './booking-ui'
import type { BookingBoard as BoardData, BookingListItem } from '@/types/booking'

function BoardCard({ item, showStatus }: { item: BookingListItem; showStatus: boolean }) {
  const router = useRouter()
  const level = stuckLevel(item)

  return (
    <button
      type="button"
      onClick={() => router.push(`/bookings/${item.id}`)}
      className={cn(
        'w-full rounded-md border border-gray-200 bg-white p-3 text-left shadow-sm',
        'transition-colors duration-150 hover:bg-gray-50',
        STUCK_BORDER_CLASS[level]
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs text-gray-600">{shortId(item.id)}</span>
        {item.isUrgent && <Badge tone="danger">Urgent</Badge>}
        {level !== 'ok' && <Badge tone={STUCK_TONE[level]}>{STUCK_LABEL[level]}</Badge>}
        {showStatus && <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>}
        {item.hasDispute && !showStatus && <Badge tone="danger">Dispute</Badge>}
      </div>

      <p className="mt-1.5 text-sm font-medium text-gray-900">
        {item.categoryName ?? item.categoryId}
        {item.city && <span className="font-normal text-gray-400"> · {item.city}</span>}
      </p>

      <p className="mt-0.5 truncate text-xs text-gray-500">
        {item.userName ?? 'Customer'} → {item.workerName ?? 'Worker'}
      </p>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-800">{formatPkr(item.amount, item.currency)}</span>
        <span className="text-gray-400">{timeAgo(item.updatedAt)}</span>
      </div>

      <div className="mt-2">
        <Badge tone={PAYMENT_TONE[item.paymentStatus]}>{PAYMENT_LABEL[item.paymentStatus]}</Badge>
      </div>
    </button>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((col) => (
        <div
          key={col}
          className="flex w-[280px] shrink-0 flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
        >
          <div className="h-5 w-32 animate-pulse rounded bg-gray-100" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ))}
    </div>
  )
}

interface Props {
  board: BoardData | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

export default function BookingBoard({ board, isLoading, error, onRetry }: Props) {
  if (error && !board) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white py-10 text-sm text-gray-500">
        <p>Couldn't load the booking board.</p>
        <button onClick={onRetry} className="text-[#1F6F5F] hover:underline">
          Retry
        </button>
      </div>
    )
  }

  if (isLoading || !board) return <BoardSkeleton />

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((col: BoardColumn) => {
        const data = board.columns[col]
        const showStatus = col === 'cancelled_disputed'

        return (
          <div
            key={col}
            className="flex w-[280px] shrink-0 flex-col rounded-lg border border-gray-200 bg-gray-50"
          >
            <div className="border-b border-gray-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">{BOARD_COLUMN_LABEL[col]}</h3>
                <span className="rounded-full bg-white px-2 text-xs font-medium text-gray-600">
                  {data.total.toLocaleString('en-PK')}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-gray-400">{BOARD_COLUMN_HINT[col]}</p>
            </div>

            <div className="flex max-h-[calc(100vh-380px)] min-h-[120px] flex-col gap-2 overflow-y-auto p-2">
              {data.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">Nothing here.</p>
              ) : (
                data.items.map((item) => (
                  <BoardCard key={item.id} item={item} showStatus={showStatus} />
                ))
              )}
            </div>

            {data.total > data.items.length && (
              <p className="border-t border-gray-200 px-3 py-2 text-center text-[11px] text-gray-500">
                Showing {data.items.length} of {data.total.toLocaleString('en-PK')}. Use the table
                view to see all.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}