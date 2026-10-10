// components/verification/VerificationHistory.tsx  (spec 2.2e)
'use client'

import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { timeAgo } from '@/components/workers/worker-ui'
import { rejectionLabel } from '@/lib/verification-constants'
import { ACTIVITY_LABEL, DECISION_LABEL, DECISION_VARIANT } from './verification-ui'
import type { VerificationActivity, VerificationReview } from '@/types/verification'

interface Props {
  reviews: VerificationReview[]
  activity: VerificationActivity[]
}

export default function VerificationHistory({ reviews, activity }: Props) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Verification history
      </h2>

      {reviews.length === 0 ? (
        <p className="text-sm text-gray-500">No previous verification attempts.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-md border border-gray-100 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge
                  status={r.decision}
                  variant={DECISION_VARIANT[r.decision]}
                  label={DECISION_LABEL[r.decision]}
                />
                <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
              </div>
              {r.decision === 'rejected' && (
                <p className="mt-1.5 text-xs font-medium text-gray-700">
                  {rejectionLabel(r.reasonCode)}
                  {r.allowResubmission === false && ' · resubmission blocked'}
                </p>
              )}
              {r.note && <p className="mt-1 text-xs text-gray-600">{r.note}</p>}
              <p className="mt-1 text-xs text-gray-400">by {r.adminEmail}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="mb-2 text-xs font-medium text-gray-700">Audit trail</p>
        {activity.length === 0 ? (
          <p className="text-xs text-gray-400">No activity logged yet.</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-gray-600">
                  <span className="font-medium text-gray-800">{a.adminEmail ?? 'System'}</span>{' '}
                  {(ACTIVITY_LABEL[a.action] ?? a.action).toLowerCase()}
                </span>
                <span className="shrink-0 text-gray-400">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}