// components/verification/VerificationHeader.tsx
'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  VERIFICATION_LABEL,
  VERIFICATION_VARIANT,
  formatDate,
  initial,
} from '@/components/workers/worker-ui'
import { SLA_TONE, formatWaiting, slaLevel } from './verification-ui'
import type { VerificationDetail } from '@/types/verification'

function HeaderSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse rounded-full bg-gray-100" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-56 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-end gap-2">
              <div className="h-6 w-8 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-14 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

interface Props {
  detail?: VerificationDetail
  isLoading?: boolean
  error?: unknown
}

export default function VerificationHeader({ detail, isLoading, error }: Props) {
  if (error) return null
  if (isLoading || !detail) return <HeaderSkeleton />

  const { worker, documents } = detail
  const pending = worker.verificationStatus === 'pending_review'
  const level = slaLevel(worker.waitingSince)
  const pendingDocs = documents.filter((d) => d.status === 'PENDING').length

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {worker.avatarUrl ? (
            <Image
              src={worker.avatarUrl}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
              {initial(worker.name)}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">
                {worker.name ?? 'Unnamed worker'}
              </h1>
              <StatusBadge
                status={worker.verificationStatus}
                variant={VERIFICATION_VARIANT[worker.verificationStatus] ?? 'neutral'}
                label={VERIFICATION_LABEL[worker.verificationStatus] ?? worker.verificationStatus}
              />
              {worker.accountStatus !== 'active' && (
                <StatusBadge
                  status={worker.accountStatus}
                  variant={STATUS_VARIANT[worker.accountStatus] ?? 'neutral'}
                  label={`Account ${STATUS_LABEL[worker.accountStatus] ?? worker.accountStatus}`}
                />
              )}
              {worker.isResubmission && pending && <Badge tone="info">Re-submitted</Badge>}
              {pending && (
                <Badge tone={SLA_TONE[level]}>Waiting {formatWaiting(worker.waitingSince)}</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {worker.phone ?? '—'} · {worker.email ?? '—'} · {worker.city ?? 'No city'}
            </p>
          </div>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-semibold text-gray-900">{documents.length}</p>
            <p className="text-xs text-gray-400">Documents</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{pendingDocs}</p>
            <p className="text-xs text-gray-400">Pending</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{worker.warningCount}</p>
            <p className="text-xs text-gray-400">Warnings</p>
          </div>
        </div>
      </div>

      {pending && worker.waitingSince && (
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
          Submitted {formatDate(worker.waitingSince)}
          {worker.isResubmission && worker.reverificationReason
            ? ` · Re-verification requested: ${worker.reverificationReason}`
            : ''}
        </p>
      )}
    </Card>
  )
}