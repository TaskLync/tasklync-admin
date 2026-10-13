// components/reviews/ReviewReports.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { ReviewReportRow } from '@/types/review'
import { REASON_LABEL, formatDateTime } from './review-ui'

export default function ReviewReports({ reports }: { reports: ReviewReportRow[] }) {
  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Reports ({reports.length})
      </h2>
      <p className="mb-3 text-xs text-gray-400">
        Only the customer and the worker on the booking can report a review. Three distinct reports
        auto-hide it.
      </p>

      {reports.length === 0 ? (
        <p className="text-sm text-gray-500">Nobody has reported this review.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-md border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">{REASON_LABEL[r.reason]}</Badge>
                  <span className="text-sm text-gray-800">
                    {r.reporterName ?? 'Unknown'}{' '}
                    <span className="text-xs text-gray-400">
                      ({r.reporterRole === 'worker' ? 'worker' : 'customer'})
                    </span>
                  </span>
                </div>
                {r.resolvedAt ? (
                  <Badge tone="neutral">Resolved</Badge>
                ) : (
                  <Badge tone="danger">Open</Badge>
                )}
              </div>
              {r.note && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{r.note}</p>
              )}
              <p className="mt-1.5 text-[11px] text-gray-400">
                Reported {formatDateTime(r.createdAt)}
                {r.resolvedAt && ` · resolved ${formatDateTime(r.resolvedAt)}`}
                {r.resolvedByName && ` by ${r.resolvedByName}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}