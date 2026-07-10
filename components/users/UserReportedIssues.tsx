// components/users/UserReportedIssues.tsx
'use client'

import { Card } from '@/components/ui/Card'
import DataTable, { DataTableColumn } from '@/components/shared/DataTable'
import { useUserReports } from '@/hooks/useUsers'
import type { UserReportRow } from '@/types/user'

const columns: DataTableColumn<UserReportRow>[] = [
  {
    key: 'direction', header: 'Direction',
    render: (r) => (r.direction === 'filed_by_user' ? 'Filed by user' : 'Filed against user'),
  },
  { key: 'counterparty', header: 'Worker', render: (r) => r.counterpartyName ?? '—' },
  { key: 'reason', header: 'Reason', render: (r) => r.reason },
  { key: 'status', header: 'Status', render: (r) => r.status },
  {
    key: 'date', header: 'Date',
    render: (r) => new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  },
]

export default function UserReportedIssues({ userId }: { userId: string }) {
  const { reports, available, isLoading, error, mutate } = useUserReports(userId)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Reported Issues</h2>
      {!available ? (
        <p className="text-sm text-gray-500">Reports aren't wired up yet — pending the reports table schema.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={reports}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={() => mutate()}
          emptyMessage="No reports involving this user."
        />
      )}
    </Card>
  )
}