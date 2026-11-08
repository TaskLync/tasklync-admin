// lib/services/worker.ts  (server only)
import { callService, bestEffort, type ServiceTarget } from '@/lib/internal-client'
import type { AdminIdentity } from '@/lib/services/booking'
import type { WorkerDocumentRow } from '@/types/worker'

const target = (): ServiceTarget => ({
  name: 'worker-service',
  url: process.env.WORKER_SERVICE_URL,
  key: process.env.WORKER_SERVICE_INTERNAL_KEY ?? process.env.INTERNAL_API_KEY,
})

const who = (a: AdminIdentity) => ({ admin_id: a.id, admin_email: a.email })

export const workerSvc = {
  verificationMeta: () => callService(target(), 'GET', '/internal/admin/verification/meta'),

  /** Documents come back with short-lived signed URLs (15 min). */
  verificationSummary: (workerId: string) =>
    callService<Record<string, unknown>>(target(), 'GET', `/internal/admin/workers/${workerId}/verification`),

  verify: (workerId: string, admin: AdminIdentity) =>
    callService(target(), 'POST', `/internal/admin/workers/${workerId}/verify`, { body: who(admin) }),

  reject: (
    workerId: string,
    admin: AdminIdentity,
    input: { reasonCode: string; note: string; allowResubmission: boolean }
  ) =>
    callService(target(), 'POST', `/internal/admin/workers/${workerId}/reject`, {
      body: {
        ...who(admin),
        reason_code: input.reasonCode,
        note: input.note,
        allow_resubmission: input.allowResubmission,
      },
    }),

  reviewDocument: (
    workerId: string,
    docId: string,
    admin: AdminIdentity,
    input: { status: 'APPROVED' | 'REJECTED'; note?: string }
  ) =>
    callService(target(), 'PATCH', `/internal/admin/workers/${workerId}/documents/${docId}/review`, {
      body: { ...who(admin), status: input.status, note: input.note },
    }),

  /** Writes the moderation columns, clears worker/chat/contact caches, emits worker.moderation_changed. */
  moderate: (
    workerId: string,
    admin: AdminIdentity,
    input: { action: 'suspend' | 'unsuspend' | 'ban'; reason: string; until?: string }
  ) =>
    callService(target(), 'POST', `/internal/admin/workers/${workerId}/moderation`, {
      body: { ...who(admin), action: input.action, reason: input.reason, until: input.until },
    }),

  /** Performance facts + active flags + last 30 days + top customers (worker-service owns them). */
  performance: (workerId: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callService<Record<string, any>>(target(), 'GET', `/internal/admin/workers/${workerId}/performance`),

  /** add | revoke a ranking flag. worker-service recomputes the multiplier and publishes worker.stats_updated. */
  rankingFlag: (workerId: string, admin: AdminIdentity, body: object) =>
    callService<{ flag_id: string; revoked?: boolean }>(
      target(), 'POST', `/internal/admin/workers/${workerId}/ranking-flags`, { body: { ...who(admin), ...body } }
    ),

  /** H-15: call after every catalog (category / service) write, or when a worker row changes by SQL. */
  invalidateCatalogCache: () =>
    bestEffort('worker-service catalog cache', () =>
      callService(target(), 'POST', '/internal/cache/invalidate', { body: { scope: 'catalog' } })
    ),

  invalidateWorkerCache: (workerId: string) =>
    bestEffort('worker-service worker cache', () =>
      callService(target(), 'POST', '/internal/cache/invalidate', { body: { scope: 'worker', worker_id: workerId } })
    ),
}

/** Accepts the three URL field names worker-service may use. Never exposes the raw storage URL. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSignedDocuments(summary: any): WorkerDocumentRow[] {
  const docs: any[] = summary?.documents ?? summary?.docs ?? []
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    fileUrl: d.signed_url ?? d.signedUrl ?? d.url ?? '',
    status: d.status,
    rejectionNote: d.rejection_note ?? d.rejectionNote ?? null,
    reviewedAt: d.reviewed_at ?? d.reviewedAt ?? null,
    createdAt: d.created_at ?? d.createdAt,
  }))
}