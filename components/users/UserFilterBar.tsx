// components/users/UserFilterBar.tsx
'use client'

import { Input } from '@/components/ui/Input'
import type { UserFilters } from '@/types/user'

interface Props {
  filters: UserFilters
  onChange: (patch: Partial<UserFilters>) => void
  onReset: () => void
  cities: string[]
}

export default function UserFilterBar({ filters, onChange, onReset, cities }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-[220px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
        <Input
          placeholder="Name, phone, or email"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">City</label>
        <select
          className="h-9 rounded-md border border-gray-300 px-3 text-sm"
          value={filters.city}
          onChange={(e) => onChange({ city: e.target.value })}
        >
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
        <select
          className="h-9 rounded-md border border-gray-300 px-3 text-sm"
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as UserFilters['status'] })}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Bookings</label>
        <select
          className="h-9 rounded-md border border-gray-300 px-3 text-sm"
          value={filters.bookingsBucket}
          onChange={(e) => onChange({ bookingsBucket: e.target.value as UserFilters['bookingsBucket'] })}
        >
          <option value="all">Any</option>
          <option value="0">0</option>
          <option value="1-5">1 – 5</option>
          <option value="5-20">5 – 20</option>
          <option value="20+">20+</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">From</label>
        <Input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ dateFrom: e.target.value || null })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">To</label>
        <Input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ dateTo: e.target.value || null })}
        />
      </div>

      <button onClick={onReset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">
        Clear filters
      </button>
    </div>
  )
}