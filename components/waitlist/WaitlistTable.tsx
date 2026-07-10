// components/waitlist/WaitlistTable.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { mutate as globalMutate } from 'swr'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/Card'
import { WaitlistFilterBar } from './WaitlistFilterBar'
import { useWaitlistList } from '@/hooks/useWaitlist'
import type { WaitlistFilters, WaitlistStatus } from '@/types/waitlist'

const STATUS_OPTIONS: WaitlistStatus[] = ['pending', 'invited', 'converted']
const SKELETON_ROWS = 8
const SKELETON_COLS = 8

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-PK', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function WaitlistTable({ utmSources }: { utmSources: string[] }) {
  const [filters, setFilters] = useState<WaitlistFilters>({ page: 1, pageSize: 25 })
  const { data, error, isLoading, mutate } = useWaitlistList(filters)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleStatusChange(id: string, status: WaitlistStatus) {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/waitlist/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Request failed')
      toast.success('Status updated')
      mutate()
      globalMutate('/api/admin/waitlist/kpis')
    } catch {
      toast.error('Could not update status. Try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (filters.pageSize ?? 25))) : 1

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Waitlist Entries {data ? `(${data.total.toLocaleString()})` : ''}
        </h2>
        <a
          href="/api/admin/waitlist/export"
          className="flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Export CSV
        </a>
      </div>

      <WaitlistFilterBar filters={filters} onChange={setFilters} utmSources={utmSources} />

      {error && (
        <p className="text-sm text-red-600">
          Couldn't load waitlist entries.{' '}
          <button onClick={() => mutate()} className="underline">
            Retry
          </button>
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <th className="py-2 pr-3 text-left font-medium">#</th>
              <th className="py-2 pr-3 text-left font-medium">Email</th>
              <th className="py-2 pr-3 text-left font-medium">Status</th>
              <th className="py-2 pr-3 text-left font-medium">Source</th>
              <th className="py-2 pr-3 text-left font-medium">Device</th>
              <th className="py-2 pr-3 text-left font-medium">IP Address</th>
              <th className="py-2 pr-3 text-left font-medium">Joined</th>
              <th className="py-2 pr-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              !data &&
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <tr key={i} className="h-11 border-b border-gray-50">
                  {Array.from({ length: SKELETON_COLS }).map((__, j) => (
                    <td key={j} className="py-1.5 pr-3">
                      <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))}

            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={SKELETON_COLS} className="py-10 text-center text-sm text-gray-400">
                  No entries match these filters.
                </td>
              </tr>
            )}

            {data &&
              data.rows.map((row) => (
                <tr
                  key={row.id}
                  className="h-11 border-b border-gray-50 even:bg-gray-50 hover:bg-gray-100/60"
                >
                  <td className="py-1.5 pr-3 text-gray-500">#{row.position}</td>
                  <td className="py-1.5 pr-3 font-medium text-gray-800">{row.email}</td>
                  <td className="py-1.5 pr-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">
                    {row.utm_source ?? 'Direct'}
                    {row.utm_medium && (
                      <span className="ml-1 text-xs text-gray-400">/ {row.utm_medium}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-600">
                    {row.is_bot ? (
                      <span className="text-xs text-gray-400">Bot / API</span>
                    ) : (
                      `${row.browser} · ${row.os}`
                    )}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-xs text-gray-500">
                    {row.ip_address ?? '—'}
                  </td>
                  <td
                    className="py-1.5 pr-3 text-gray-500"
                    title={new Date(row.created_at).toLocaleString('en-PK')}
                  >
                    {timeAgo(row.created_at)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <select
                      value={row.status}
                      disabled={updatingId === row.id}
                      onChange={(e) => handleStatusChange(row.id, e.target.value as WaitlistStatus)}
                      className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-[#1F6F5F] focus:outline-none disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">
            Page {filters.page ?? 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}