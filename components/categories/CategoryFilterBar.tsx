'use client'

import { Input } from '@/components/ui/Input'
import type { CategoryFilters } from '@/types/category'

interface Props {
  filters: CategoryFilters
  onChange: (patch: Partial<CategoryFilters>) => void
  onReset: () => void
}

export default function CategoryFilterBar({ filters, onChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-[220px] flex-1">
        <Input
          label="Search"
          placeholder="Name or ID"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
        <select
          className="h-9 rounded-md border border-gray-300 px-3 text-sm"
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as CategoryFilters['status'] })}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <button onClick={onReset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">
        Clear filters
      </button>
    </div>
  )
}