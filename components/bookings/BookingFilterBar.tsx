// components/bookings/BookingFilterBar.tsx
'use client'

import { Input } from '@/components/ui/Input'
import { BOOKING_STATUSES, PAYMENT_STATUSES, STATUS_LABEL } from '@/lib/booking-constants'
import type { CategoryOption } from '@/types/worker'
import type { BookingFilters } from '@/types/booking'
import { PAYMENT_LABEL } from './booking-ui'

interface Props {
  filters: BookingFilters
  onChange: (patch: Partial<BookingFilters>) => void
  onReset: () => void
  cities: string[]
  categories: CategoryOption[]
  /** The kanban columns already are the statuses, so the status select is hidden there. */
  hideStatus?: boolean
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

export default function BookingFilterBar({
  filters,
  onChange,
  onReset,
  cities,
  categories,
  hideStatus,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-[240px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
        <Input
          placeholder="Booking ID, customer, worker or phone"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />
      </div>

      {!hideStatus && (
        <Field label="Status">
          <select
            className={SELECT_CLASS}
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value as BookingFilters['status'] })}
          >
            <option value="all">All</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      )}

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

      <Field label="Payment">
        <select
          className={SELECT_CLASS}
          value={filters.paymentStatus}
          onChange={(e) =>
            onChange({ paymentStatus: e.target.value as BookingFilters['paymentStatus'] })
          }
        >
          <option value="all">Any</option>
          {PAYMENT_STATUSES.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_LABEL[p]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Dispute">
        <select
          className={SELECT_CLASS}
          value={filters.hasDispute}
          onChange={(e) => onChange({ hasDispute: e.target.value as BookingFilters['hasDispute'] })}
        >
          <option value="all">Any</option>
          <option value="yes">Has dispute</option>
          <option value="no">No dispute</option>
        </select>
      </Field>

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

      <Field label="Created from">
        <Input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ dateFrom: e.target.value || null })}
        />
      </Field>
      <Field label="Created to">
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