// components/users/UserBookingHistory.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { useUserBookings } from '@/hooks/useUsers'
import type { UserBookingRow } from '@/types/user'

const columns: DataTableColumn<UserBookingRow>[] = [
  { key: 'worker', header: 'Worker', render: (r) => r.workerName ?? '—' },
  { key: 'category', header: 'Category', render: (r) => r.category ?? '—' },
  { key: 'status', header: 'Status', render: (r) => r.status },
  { key: 'amount', header: 'Amount', render: (r) => (r.amount != null ? `PKR ${r.amount.toLocaleString()}` : '—') },
  {
    key: 'date', header: 'Date',
    render: (r) => new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  },
]

export default function UserBookingHistory({ userId }: { userId: string }) {
  const { bookings, available, isLoading, error, mutate } = useUserBookings(userId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Booking History</h2>
      {!available ? (
        <p className="text-sm text-gray-500">
          Booking history isn't wired up yet — it'll appear here once the{' '}
          <Link href="#" className="text-[--accent] hover:underline">Bookings page</Link> ships.
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={bookings}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={() => mutate()}
          emptyMessage="No bookings yet."
        />
      )}
    </Card>
  )
}