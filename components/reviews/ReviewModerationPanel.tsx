// components/reviews/ReviewModerationPanel.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { canHide, canRestore, type ModerationAction } from '@/lib/review-constants'
import { usePermission } from '@/hooks/usePermission'
import type { ReviewDetail } from '@/types/review'
import { ModerateReviewDialog, WarnReviewerDialog } from './ReviewModerationDialogs'
import { MODERATION_LABEL, MODERATION_TONE } from './review-ui'

type DialogKind = ModerationAction | 'warn' | null

export default function ReviewModerationPanel({
  review,
  onChanged,
}: {
  review: ReviewDetail
  onChanged: () => void
}) {
  const canModerate = usePermission('reviews:moderate')
  const canWarn = usePermission('users:warn')
  const [dialog, setDialog] = useState<DialogKind>(null)

  const status = review.moderationStatus
  const hasOpenReports = review.openReportCount > 0
  // "Keep" = dismiss reports. Not offered on a review an admin hid (use Restore instead).
  const canKeep = hasOpenReports && status !== 'ADMIN_HIDDEN'

  const showHide = canModerate && canHide(status)
  const showRestore = canModerate && canRestore(status)
  const showKeep = canModerate && canKeep
  const showWarn = canWarn && !!review.reviewer.id

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Moderation</h2>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm">
        <Badge tone={MODERATION_TONE[status]}>{MODERATION_LABEL[status]}</Badge>
        <span className="text-xs text-gray-500">
          {hasOpenReports
            ? `${review.openReportCount} open report${review.openReportCount === 1 ? '' : 's'}`
            : 'No open reports'}
        </span>
      </div>

      {status === 'AUTO_HIDDEN' && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Auto-hidden after reaching the report threshold. It is off the public page until you decide.
        </p>
      )}

      {!canModerate && !showWarn && (
        <p className="text-sm text-gray-500">You have view-only access to reviews.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {showKeep && (
          <Button variant="secondary" onClick={() => setDialog('dismiss')}>
            Keep review
          </Button>
        )}
        {showRestore && (
          <Button variant="secondary" onClick={() => setDialog('restore')}>
            Restore review
          </Button>
        )}
        {showHide && (
          <Button variant="destructive" onClick={() => setDialog('hide')}>
            Hide review
          </Button>
        )}
      </div>

      {showWarn && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <Button variant="ghost" onClick={() => setDialog('warn')}>
            Warn the reviewer
          </Button>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Every decision needs a reason and is written to the audit log. The public rating summary
        refreshes within 5 minutes. The worker's headline average is maintained by worker-service.
      </p>

      {(dialog === 'hide' || dialog === 'restore' || dialog === 'dismiss') && (
        <ModerateReviewDialog
          action={dialog}
          review={review}
          onClose={() => setDialog(null)}
          onDone={() => {
            toast.success(
              dialog === 'hide'
                ? 'Review hidden'
                : dialog === 'restore'
                  ? 'Review restored'
                  : 'Reports dismissed'
            )
            onChanged()
          }}
        />
      )}

      {dialog === 'warn' && (
        <WarnReviewerDialog
          review={review}
          onClose={() => setDialog(null)}
          onDone={() => {
            toast.success('Warning sent to the reviewer')
            onChanged()
          }}
        />
      )}
    </Card>
  )
}