// lib/services/review.ts  (server only)
import { callService, type ServiceTarget } from '@/lib/internal-client'
import type { AdminIdentity } from '@/lib/services/booking'
import type { ModerationAction } from '@/lib/review-constants'

const target = (): ServiceTarget => ({
  name: 'review-service',
  url: process.env.REVIEW_SERVICE_URL,
  key: process.env.REVIEW_SERVICE_INTERNAL_KEY ?? process.env.INTERNAL_API_KEY,
})

export const reviewSvc = {
  /** The only path that makes review-service emit review.moderated (ratings + search update). */
  moderate: (reviewId: string, admin: AdminIdentity, input: { action: ModerationAction; note: string }) =>
    callService(target(), 'PATCH', `/internal/reviews/${reviewId}/moderate`, {
      body: { action: input.action, note: input.note, admin_id: admin.id },
    }),
}