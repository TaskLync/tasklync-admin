// components/disputes/DisputeFilterBar.tsx
'use client'

import { Input } from '@/components/ui/Input'
import { DISPUTE_RESOLUTIONS } from '@/lib/dispute-constants'
import type { CategoryOption } from '@/types/worker'
import type { DisputeFilters } from '@/types/dispute'
import { Field, RESOLUTION_LABEL, SELECT_CLASS } from './dispute-ui'

interface Props {
  filters: DisputeFilters
  onChange: (patch: Partial<DisputeFilters>) => void
  onReset: () => void
  cities: string[]
  categories: CategoryOption[]
}

export default function DisputeFilterBar({ filters, onChange, onReset, cities, categories }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-[240px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
        <Input
          placeholder="Dispute ID, booking ID, customer, worker or phone"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <Field label="City">
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
      </Field>

      <Field label="Category">
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
      </Field>

      <Field label="Assigned">
        <select
          className={SELECT_CLASS}
          value={filters.assigned}
          onChange={(e) => onChange({ assigned: e.target.value as DisputeFilters['assigned'] })}
        >
          <option value="all">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </Field>

      {filters.tab === 'resolved' && (
        <Field label="Outcome">
          <select
            className={SELECT_CLASS}
            value={filters.resolution}
            onChange={(e) => onChange({ resolution: e.target.value as DisputeFilters['resolution'] })}
          >
            <option value="all">Any</option>
            {DISPUTE_RESOLUTIONS.map((r) => (
              <option key={r} value={r}>
                {RESOLUTION_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Min amount (PKR)">
        <Input
          type="number"
          min={0}
          className="w-28"
          value={filters.amountMin}
          onChange={(e) => onChange({ amountMin: e.target.value })}
        />
      </Field>
      <Field label="Max amount (PKR)">
        <Input
          type="number"
          min={0}
          className="w-28"
          value={filters.amountMax}
          onChange={(e) => onChange({ amountMax: e.target.value })}
        />
      </Field>

      <Field label="Opened from">
        <Input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ dateFrom: e.target.value || null })}
        />
      </Field>
      <Field label="Opened to">
        <Input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ dateTo: e.target.value || null })}
        />
      </Field>

      <button onClick={onReset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">
        Clear filters
      </button>
    </div>
  )
}