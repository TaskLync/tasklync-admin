// components/reviews/RatingAuditTab.tsx  (spec 10.3)
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { AUDIT_FLAGS } from '@/lib/review-constants'
import { useAuditFilters, useReviewAudit } from '@/hooks/useReviews'
import type { AuditWorkerRow } from '@/types/review'
import {
  AUDIT_FLAG_HINT,
  AUDIT_FLAG_LABEL,
  AUDIT_FLAG_TONE,
  Field,
  KNOWN_CITIES,
  Pager,
  Person,
  SELECT_CLASS,
  Stars,
} from './review-ui'

const columns: DataTableColumn<AuditWorkerRow>[] = [
  {
    key: 'worker',
    header: 'Worker',
    render: (w) => <Person name={w.name} phone={w.phone} />,
  },
  { key: 'city', header: 'City', render: (w) => w.city ?? '—' },
  {
    key: 'rating',
    header: 'Rating',
    render: (w) =>
      w.avgRating === null ? (
        <span className="text-gray-400">No reviews</span>
      ) : (
        <div className="flex flex-col leading-tight">
          <span className="flex items-center gap-1.5">
            <Stars rating={Math.round(w.avgRating)} />
            <span className="font-medium text-gray-900">{w.avgRating.toFixed(2)}</span>
          </span>
          <span className="text-[11px] text-gray-400">{w.totalReviews} visible reviews</span>
        </div>
      ),
  },
  {
    key: 'drop',
    header: 'Last 7 days',
    render: (w) => {
      if (w.drop === null) return <span className="text-gray-400">—</span>
      const down = w.drop > 0
      return (
        <span className={down ? 'font-medium text-[#DC2626]' : 'text-gray-600'}>
          {down ? '▼' : w.drop < 0 ? '▲' : '='} {Math.abs(w.drop).toFixed(2)}
          <span className="ml-1 text-[11px] text-gray-400">({w.recentReviews} new)</span>
        </span>
      )
    },
  },
  {
    key: 'disputes',
    header: 'Disputes (30d)',
    render: (w) => (
      <span className={w.disputes30d >= 3 ? 'font-medium text-[#DC2626]' : 'text-gray-600'}>
        {w.disputes30d}
      </span>
    ),
  },
  { key: 'warnings', header: 'Warnings', render: (w) => w.warningCount },
  {
    key: 'flags',
    header: 'Flags',
    render: (w) => (
      <div className="flex flex-wrap gap-1">
        {w.flags.map((f) => (
          <span key={f} title={AUDIT_FLAG_HINT[f]}>
            <Badge tone={AUDIT_FLAG_TONE[f]}>{AUDIT_FLAG_LABEL[f]}</Badge>
          </span>
        ))}
      </div>
    ),
  },
  {
    key: 'actions',
    header: '',
    className: 'text-right',
    render: (w) => (
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/reviews?workerId=${w.workerId}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50"
        >
          Reviews
        </Link>
        <Link
          href={`/workers/${w.workerId}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 items-center rounded-md bg-[#1F6F5F] px-2.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-[#195c4f]"
        >
          Open worker
        </Link>
      </div>
    ),
  },
]

export default function RatingAuditTab() {
  const router = useRouter()
  const { filters, update, reset } = useAuditFilters()
  const { audit, isLoading, error, mutate } = useReviewAudit(filters)

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-xs text-gray-500">
        {AUDIT_FLAGS.map((f) => (
          <span key={f}>
            <Badge tone={AUDIT_FLAG_TONE[f]}>{AUDIT_FLAG_LABEL[f]}</Badge>{' '}
            <span className="ml-1">{AUDIT_FLAG_HINT[f]}</span>
          </span>
        ))}
      </Card>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
          <Input
            placeholder="Worker name or phone"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>
        <Field label="Flag">
          <select
            className={SELECT_CLASS}
            value={filters.flag}
            onChange={(e) => update({ flag: e.target.value as typeof filters.flag })}
          >
            <option value="all">Any flag</option>
            {AUDIT_FLAGS.map((f) => (
              <option key={f} value={f}>
                {AUDIT_FLAG_LABEL[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <select
            className={SELECT_CLASS}
            value={filters.city}
            onChange={(e) => update({ city: e.target.value })}
          >
            <option value="all">All cities</option>
            {KNOWN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <button onClick={reset} className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700">
          Clear filters
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={audit?.data ?? []}
        rowKey={(w) => w.workerId}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
        emptyMessage="No workers are flagged right now."
        onRowClick={(w) => router.push(`/workers/${w.workerId}`)}
      />

      {audit && (
        <Pager
          page={filters.page}
          pageSize={filters.pageSize}
          total={audit.total}
          onPage={(page) => update({ page })}
        />
      )}
    </div>
  )
}