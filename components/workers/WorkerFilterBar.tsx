// components/workers/WorkerFilterBar.tsx
'use client'

import { Input } from '@/components/ui/Input'
import type { CategoryOption, WorkerFilters } from '@/types/worker'

interface Props {
  filters: WorkerFilters
  onChange: (patch: Partial<WorkerFilters>) => void
  onReset: () => void
  cities: string[]
  categories: CategoryOption[]
}

const SELECT_CLASS = 'h-9 rounded-md border border-gray-300 px-3 text-sm'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

export default function WorkerFilterBar({ filters, onChange, onReset, cities, categories }: Props) {
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

      <Field label="City">
        <select
          className={SELECT_CLASS}
          value={filters.city}
          onChange={(e) => onChange({ city: e.target.value })}
        >
          <option value="all">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
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
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Verification">
        <select
          className={SELECT_CLASS}
          value={filters.verification}
          onChange={(e) => onChange({ verification: e.target.value as WorkerFilters['verification'] })}
        >
          <option value="all">All</option>
          <option value="verified">Verified</option>
          <option value="pending_review">Pending review</option>
          <option value="unverified">Unverified</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </Field>

      <Field label="Status">
        <select
          className={SELECT_CLASS}
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as WorkerFilters['status'] })}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="deleted">Deleted</option>
        </select>
      </Field>

      <Field label="Presence">
        <select
          className={SELECT_CLASS}
          value={filters.presence}
          onChange={(e) => onChange({ presence: e.target.value as WorkerFilters['presence'] })}
        >
          <option value="all">Any</option>
          <option value="online">Online</option>
          <option value="away">Away</option>
          <option value="on_job">On job</option>
          <option value="paused">Paused</option>
          <option value="offline">Offline</option>
        </select>
      </Field>

      <Field label="Rating">
        <select
          className={SELECT_CLASS}
          value={filters.ratingBucket}
          onChange={(e) => onChange({ ratingBucket: e.target.value as WorkerFilters['ratingBucket'] })}
        >
          <option value="all">Any</option>
          <option value="lt3">Below 3.0 (needs review)</option>
          <option value="3-4">3.0 – 3.9</option>
          <option value="4+">4.0 +</option>
          <option value="unrated">No reviews yet</option>
        </select>
      </Field>

      <Field label="From">
        <Input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ dateFrom: e.target.value || null })}
        />
      </Field>
      <Field label="To">
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