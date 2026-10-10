// components/disputes/DisputeHeader.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { isActiveDispute } from '@/lib/dispute-constants'
import type { DisputeDetail } from '@/types/dispute'
import {
  RESOLUTION_LABEL,
  RESOLUTION_TONE,
  SLA_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  formatAge,
  formatDate,
  formatPkr,
  responseState,
  shortId,
  slaLevel,
  useNow,
} from './dispute-ui'

function HeaderSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-52 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-end gap-2">
              <div className="h-6 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-14 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

interface Props {
  dispute?: DisputeDetail
  isLoading?: boolean
  error?: unknown
}

export default function DisputeHeader({ dispute, isLoading, error }: Props) {
  const now = useNow(60_000)

  if (error) return null
  if (isLoading || !dispute) return <HeaderSkeleton />

  const active = isActiveDispute(dispute.status)
  const level = slaLevel(dispute.createdAt, now)
  const resp = responseState(dispute, now)
  const b = dispute.booking

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-gray-900">{shortId(dispute.id)}</h1>
            <Badge tone={STATUS_TONE[dispute.status]}>{STATUS_LABEL[dispute.status]}</Badge>
            {dispute.resolution && (
              <Badge tone={RESOLUTION_TONE[dispute.resolution]}>
                {RESOLUTION_LABEL[dispute.resolution]}
              </Badge>
            )}
            {dispute.isEscalated && <Badge tone="danger">Escalated</Badge>}
            {dispute.openedByAdmin && <Badge tone="info">Admin-opened</Badge>}
            {active && <Badge tone={SLA_TONE[level]}>Open {formatAge(dispute.createdAt, now)}</Badge>}
            {active && resp.kind !== 'responded' && <Badge tone={resp.tone}>{resp.label}</Badge>}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {b.categoryName ?? b.categoryId}
            {b.city && ` · ${b.city}`}
            {' · Booking '}
            <Link
              href={`/bookings/${b.id}`}
              className="font-mono text-gray-700 hover:text-[#1F6F5F] hover:underline"
            >
              {shortId(b.id)}
            </Link>
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-gray-400">{dispute.id}</p>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatPkr(b.estimatedTotal, b.currency)}
            </p>
            <p className="text-xs text-gray-400">At stake</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{dispute.evidenceUrls.length}</p>
            <p className="text-xs text-gray-400">Evidence files</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">{formatDate(dispute.createdAt)}</p>
            <p className="text-xs text-gray-400">Opened</p>
          </div>
        </div>
      </div>

      {dispute.isEscalated && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          Escalated{dispute.escalatedByName ? ` by ${dispute.escalatedByName}` : ''}
          {dispute.escalationNote ? `: ${dispute.escalationNote}` : '.'}
        </p>
      )}
    </Card>
  )
}