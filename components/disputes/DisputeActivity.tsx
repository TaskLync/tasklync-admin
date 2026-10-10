// components/disputes/DisputeActivity.tsx  (audit trail for this dispute)
'use client'

import { Card } from '@/components/ui/Card'
import type { DisputeActivityRow } from '@/types/dispute'
import { ACTIVITY_LABEL, timeAgo } from './dispute-ui'

export default function DisputeActivity({ activity }: { activity: DisputeActivityRow[] }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Audit trail
      </h2>

      {activity.length === 0 ? (
        <p className="text-sm text-gray-500">No admin activity yet.</p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-2.5 overflow-y-auto pr-1">
          {activity.map((a) => (
            <li key={a.id} className="text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-600">
                  <span className="font-medium text-gray-800">{a.adminEmail ?? 'System'}</span>{' '}
                  {ACTIVITY_LABEL[a.action] ?? a.action}
                </span>
                <span className="shrink-0 text-gray-400">{timeAgo(a.createdAt)}</span>
              </div>
              {a.notes && a.action !== 'dispute.note_added' && (
                <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-gray-500">
                  {a.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}