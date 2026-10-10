// components/workers/WorkerJobHistory.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { useWorkerJobs } from '@/hooks/useWorkers'
import { formatDate, formatPkr } from './worker-ui'
import type { WorkerJobRow } from '@/types/worker'

const columns: DataTableColumn<WorkerJobRow>[] = [
  { key: 'customer', header: 'Customer', render: (r) => r.customerName ?? '—' },
  { key: 'category', header: 'Category', render: (r) => r.category ?? '—' },
  { key: 'status', header: 'Status', render: (r) => r.status },
  { key: 'amount', header: 'Amount', render: (r) => formatPkr(r.amount) },
  { key: 'date', header: 'Date', render: (r) => formatDate(r.createdAt) },
]

export default function WorkerJobHistory({ workerId }: { workerId: string }) {
  const { jobs, available, isLoading, error, mutate } = useWorkerJobs(workerId)
  const router = useRouter()

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Job History</h2>
      {!available ? (
        <p className="text-sm text-gray-500">
          Job history isn't wired up yet — it'll appear here once the{' '}
          <Link href="/bookings" className="text-[#1F6F5F] hover:underline">Bookings page</Link> ships.
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={jobs}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={() => mutate()}
          emptyMessage="No jobs yet."
          onRowClick={(r) => router.push(`/bookings/${r.id}`)}
        />
      )}
    </Card>
  )
}