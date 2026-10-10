// components/verification/VerificationFilterBar.tsx
'use client'

import { Input } from '@/components/ui/Input'
import type { CategoryOption } from '@/types/worker'
import type { VerificationQueueFilters } from '@/types/verification'

interface Props {
  filters: VerificationQueueFilters
  onChange: (patch: Partial<VerificationQueueFilters>) => void
  onReset: () => void
  cities: string[]
  categories: CategoryOption[]
}

const SELECT_CLASS = 'h-9 rounded-md border border-gray-300 px-3 text-sm'

export default function VerificationFilterBar({
  filters,
  onChange,
  onReset,
  cities,
  categories,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-[220px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
        <Input
          placeholder="Name or phone"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">City</label>
        <select
          className={SELECT_CLASS}
          value={filters.city}
          onChange={(e) => onChange({ city: e.target.value })}
        >
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
        <select
          className={SELECT_CLASS}
          value={filters.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value })}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button onClick={onReset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">
        Clear filters
      </button>
    </div>
  )
}