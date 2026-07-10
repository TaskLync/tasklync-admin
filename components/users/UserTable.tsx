// components/users/UserTable.tsx
'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { UserListItem } from '@/types/user'

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'warning',
  banned: 'danger',
  deleted: 'danger',
}

interface Props {
  rows: UserListItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

export default function UserTable({ rows, isLoading, error, onRetry }: Props) {
  const router = useRouter()

  const columns: DataTableColumn<UserListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (u) => (
        <div className="flex items-center gap-2">
          {u.avatarUrl ? (
            <Image src={u.avatarUrl} alt="" width={24} height={24} className="rounded-full" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-gray-200 text-center text-[10px] leading-6 text-gray-500">
              {(u.name ?? '?').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-gray-900">{u.name ?? 'Unnamed'}</span>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (u) => u.phone ?? '—', className: 'font-mono text-xs' },
    { key: 'city', header: 'City', render: (u) => u.city ?? '—' },
    { key: 'bookings', header: 'Bookings', render: (u) => u.totalBookings },
    {
      key: 'joined',
      header: 'Joined',
      render: (u) => new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge status={u.status} variant={STATUS_VARIANT[u.status] ?? 'neutral'} />,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(u) => u.id}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyMessage="No users match these filters."
      onRowClick={(u) => router.push(`/users/${u.id}`)}
    />
  )
}