// components/workers/WorkersTableSection.tsx
'use client'

import { useMemo } from 'react'
import {
  buildWorkerExportQuery,
  useWorkerFilterOptions,
  useWorkerFilters,
  useWorkersList,
} from '@/hooks/useWorkers'
import WorkerFilterBar from './WorkerFilterBar'
import WorkerTable from './WorkerTable'

const KNOWN_CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi']

export default function WorkersTableSection() {
  const { filters, update, reset } = useWorkerFilters()
  const { workers, isLoading, error, mutate } = useWorkersList(filters)
  const { categories } = useWorkerFilterOptions()

  const totalPages = workers?.totalPages ?? 1

  const pageSummary = useMemo(() => {
    if (!workers) return ''
    const start = (workers.page - 1) * workers.pageSize + 1
    const end = Math.min(workers.page * workers.pageSize, workers.total)
    return `${start}–${end} of ${workers.total}`
  }, [workers])

  const exportHref = `/api/admin/workers/export?${buildWorkerExportQuery(filters)}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Workers {workers ? `(${workers.total.toLocaleString()})` : ''}
        </h2>
        <a
          href={exportHref}
          className="flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>

      <WorkerFilterBar
        filters={filters}
        onChange={update}
        onReset={reset}
        cities={KNOWN_CITIES}
        categories={categories}
      />

      <WorkerTable
        rows={workers?.data ?? []}
        isLoading={isLoading}
        error={error}
        onRetry={() => mutate()}
      />

      {workers && workers.total > 0 && (
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