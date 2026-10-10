// components/workers/WorkerDocuments.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import { useWorkerDocuments } from '@/hooks/useWorkers'
import { formatDate } from './worker-ui'

const TYPE_LABEL: Record<string, string> = {
  NATIONAL_ID: 'National ID (CNIC)',
  PASSPORT: 'Passport',
  SKILL_CERTIFICATE: 'Skill certificate',
  POLICE_CLEARANCE: 'Police clearance',
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
}

export default function WorkerDocuments({ workerId }: { workerId: string }) {
  // CNIC / passport images: only roles with workers:verify may load them.
  const canView = usePermission('workers:verify')
  const { documents, isLoading, error } = useWorkerDocuments(workerId, canView)
  const hasPending = documents.some((d) => d.status === 'PENDING')

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Documents</h2>

      {canView && hasPending && (
        <Link
          href={`/workers/verification/${workerId}`}
          className="mb-3 block rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 transition-colors duration-150 hover:bg-amber-100"
        >
          Documents awaiting review. Open verification →
        </Link>
      )}

      {!canView ? (
        <p className="text-sm text-gray-500">You don't have access to verification documents.</p>
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-md border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-28 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-14 animate-pulse rounded-full bg-gray-100" />
              </div>
              <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-gray-500">Couldn't load documents.</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents uploaded.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((d) => (
            <li key={d.id} className="rounded-md border border-gray-100 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{TYPE_LABEL[d.type] ?? d.type}</span>
                <StatusBadge
                  status={d.status}
                  variant={STATUS_VARIANT[d.status] ?? 'neutral'}
                  label={STATUS_LABEL[d.status] ?? d.status}
                />
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                Uploaded {formatDate(d.createdAt)}
                {d.reviewedAt && ` · reviewed ${formatDate(d.reviewedAt)}`}
              </p>
              {d.rejectionNote && <p className="mt-1 text-xs text-red-600">{d.rejectionNote}</p>}
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block text-xs text-[#1F6F5F] hover:underline"
              >
                View file
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}