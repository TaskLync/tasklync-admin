// components/reviews/ReviewFilterBar.tsx
'use client'

import { Input } from '@/components/ui/Input'
import {
  MODERATION_STATUSES,
  REVIEW_SIGNALS,
} from '@/lib/review-constants'
import type { CategoryOption } from '@/types/worker'
import type { ReviewFilters } from '@/types/review'
import { Field, MODERATION_LABEL, SELECT_CLASS, SIGNAL_LABEL } from './review-ui'

interface Props {
  filters: ReviewFilters
  onChange: (patch: Partial<ReviewFilters>) => void
  onReset: () => void
  cities: string[]
  categories: CategoryOption[]
}

export default function ReviewFilterBar({ filters, onChange, onReset, cities, categories }: Props) {
  const isAll = filters.tab === 'all'

  return (
    <div className="flex flex-col gap-2">
      {(filters.workerId || filters.userId) && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-[#1F6F5F]/10 px-3 py-2 text-xs text-[#1F6F5F]">
          <span>
            Showing reviews for one {filters.workerId ? 'worker' : 'reviewer'} only.
          </span>
          <button
            onClick={() => onChange({ workerId: '', userId: '' })}
            className="font-medium underline"
          >
            Show everyone
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
          <Input
            placeholder="Review text, review ID, booking ID, customer, worker or phone"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>

        <Field label="Rating">
          <select
            className={SELECT_CLASS}
            value={filters.rating}
            onChange={(e) => onChange({ rating: e.target.value })}
          >
            <option value="all">Any</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={String(n)}>
                {n} {n === 1 ? 'star' : 'stars'}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Worker city">
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

        {isAll && (
          <>
            <Field label="Status">
              <select
                className={SELECT_CLASS}
                value={filters.status}
                onChange={(e) => onChange({ status: e.target.value as ReviewFilters['status'] })}
              >
                <option value="all">Any</option>
                {MODERATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {MODERATION_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Signal">
              <select
                className={SELECT_CLASS}
                value={filters.signal}
                onChange={(e) => onChange({ signal: e.target.value as ReviewFilters['signal'] })}
              >
                <option value="all">Any</option>
                {REVIEW_SIGNALS.map((s) => (
                  <option key={s} value={s}>
                    {SIGNAL_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <Field label="Posted from">
          <Input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => onChange({ dateFrom: e.target.value || null })}
          />
        </Field>
        <Field label="Posted to">
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
    </div>
  )
}