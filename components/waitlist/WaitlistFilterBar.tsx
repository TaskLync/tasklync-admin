// components/waitlist/WaitlistFilterBar.tsx
'use client'

import { Search } from 'lucide-react'
import type { WaitlistFilters, WaitlistStatus } from '@/types/waitlist'

interface Props {
  filters: WaitlistFilters
  onChange: (filters: WaitlistFilters) => void
  utmSources: string[]
}

const STATUS_OPTIONS: { label: string; value: WaitlistStatus | 'all' }[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Invited', value: 'invited' },
  { label: 'Converted', value: 'converted' },
]

const inputClass =
  'h-9 rounded-md border border-gray-300 px-3 text-sm focus:border-[#1F6F5F] focus:outline-none focus:ring-2 focus:ring-[#1F6F5F]/20'

export function WaitlistFilterBar({ filters, onChange, utmSources }: Props) {
  const hasActiveFilters =
    filters.search ||
    (filters.status && filters.status !== 'all') ||
    (filters.utm_source && filters.utm_source !== 'all') ||
    filters.dateFrom ||
    filters.dateTo

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Search</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email"
            value={filters.search ?? ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
            className={`${inputClass} w-56 pl-8`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Status</label>
        <select
          value={filters.status ?? 'all'}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as WaitlistStatus | 'all', page: 1 })
          }
          className={inputClass}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Source</label>
        <select
          value={filters.utm_source ?? 'all'}
          onChange={(e) => onChange({ ...filters, utm_source: e.target.value, page: 1 })}
          className={inputClass}
        >
          <option value="all">All sources</option>
          <option value="direct">Direct</option>
          {utmSources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">From</label>
        <input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value, page: 1 })}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">To</label>
        <input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value, page: 1 })}
          className={inputClass}
        />
      </div>

      {hasActiveFilters && (
        <button
          onClick={() => onChange({ page: 1, pageSize: filters.pageSize })}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}