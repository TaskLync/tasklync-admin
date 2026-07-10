'use client'

import { ReactNode } from 'react'

export interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  error?: unknown
  emptyMessage?: string
  onRetry?: () => void
  rowClassName?: (row: T) => string
  onRowClick?: (row: T) => void
  skeletonRows?: number
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  emptyMessage = 'Nothing here yet.',
  onRetry,
  rowClassName,
  onRowClick,
  skeletonRows = 8,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-3 py-2 text-left font-medium ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="h-11 border-b border-gray-50 last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2">
                    <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-gray-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-white py-10 text-sm text-gray-500">
        <p>Couldn't load this data.</p>
        {onRetry && (
          <button onClick={onRetry} className="text-[--accent] hover:underline">
            Retry
          </button>
        )}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 text-left font-medium ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`h-11 even:bg-gray-50 hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row) ?? ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2 text-gray-700 ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}