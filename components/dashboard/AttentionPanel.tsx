// components/dashboard/AttentionPanel.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useNeedsAttention } from '@/hooks/useDashboard'

interface Row {
  key: string
  label: string
  href: string
  severity: 'danger' | 'warning' | 'neutral'
}

export function AttentionPanel() {
  const { data, error, isLoading } = useNeedsAttention()

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Needs Attention
      </h2>

      {error && (
        <p className="text-sm text-red-600">Couldn't load attention items.</p>
      )}

      {isLoading && !data && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {data && (
        <div className="flex flex-col divide-y divide-gray-100">
          {buildRows(data).length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              Nothing needs attention right now.
            </p>
          )}
          {buildRows(data).map((row) => (
            <Link
              key={row.key}
              href={row.href}
              className="flex items-center justify-between py-2.5 text-sm text-gray-800 transition-colors duration-150 hover:bg-gray-50"
            >
              <span>{row.label}</span>
              <Badge tone={row.severity}>{row.severity === 'danger' ? 'Urgent' : row.severity === 'warning' ? 'Review' : 'Info'}</Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

function buildRows(data: NonNullable<ReturnType<typeof useNeedsAttention>['data']>): Row[] {
  const rows: Row[] = []

  if (data.staleDisputes.length) {
    rows.push({
      key: 'disputes',
      label: `${data.staleDisputes.length} unresolved dispute${data.staleDisputes.length > 1 ? 's' : ''} older than 24h`,
      href: '/disputes',
      severity: 'danger',
    })
  }
  if (data.staleVerifications.length) {
    rows.push({
      key: 'verifications',
      label: `${data.staleVerifications.length} worker${data.staleVerifications.length > 1 ? 's' : ''} pending verification 48h+`,
      href: '/workers/verification',
      severity: 'warning',
    })
  }
  if (data.failedPayments.length) {
    rows.push({
      key: 'payments',
      label: `${data.failedPayments.length} failed payment${data.failedPayments.length > 1 ? 's' : ''} awaiting retry`,
      href: '/payments?status=failed',
      severity: 'danger',
    })
  }
  if (data.stuckPendingBookings.length) {
    rows.push({
      key: 'bookings',
      label: `${data.stuckPendingBookings.length} booking${data.stuckPendingBookings.length > 1 ? 's' : ''} stuck in Pending 30min+`,
      href: '/bookings?status=CREATED',
      severity: 'warning',
    })
  }
  if (data.flaggedReviews.length) {
    rows.push({
      key: 'reviews',
      label: `${data.flaggedReviews.length} flagged review${data.flaggedReviews.length > 1 ? 's' : ''} awaiting moderation`,
      href: '/reviews?flagged=true',
      severity: 'neutral',
    })
  }

  return rows
}