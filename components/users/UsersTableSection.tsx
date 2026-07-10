'use client'

import { useMemo } from 'react'
import { useUsersList, useUserFilters } from '@/hooks/useUsers'
import UserFilterBar from './UserFilterBar'
import UserTable from './UserTable'
import type { UserFilters } from '@/types/user'

const KNOWN_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi']

function buildExportQuery(filters: UserFilters): string {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (filters.city !== 'all') qs.set('city', filters.city)
  if (filters.status !== 'all') qs.set('status', filters.status)
  if (filters.bookingsBucket !== 'all') qs.set('bookingsBucket', filters.bookingsBucket)
  if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) qs.set('dateTo', filters.dateTo)
  return qs.toString()
}

export default function UsersTableSection() {
  const { filters, update, reset } = useUserFilters()
  const { users, isLoading, error, mutate } = useUsersList(filters)

  const totalPages = users?.totalPages ?? 1

  const pageSummary = useMemo(() => {
    if (!users) return ''
    const start = (users.page - 1) * users.pageSize + 1
    const end = Math.min(users.page * users.pageSize, users.total)
    return `${start}–${end} of ${users.total}`
  }, [users])

  const exportHref = `/api/admin/users/export?${buildExportQuery(filters)}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Users {users ? `(${users.total.toLocaleString()})` : ''}
        </h2>
        <a
          href={exportHref}
          className="flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>

      <UserFilterBar filters={filters} onChange={update} onReset={reset} cities={KNOWN_CITIES} />

      <UserTable
        rows={users?.data ?? []}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
      />

      {users && users.total > 0 && (
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
    </div>
  )
}