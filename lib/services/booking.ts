// lib/services/booking.ts  (server only)
import { callService, type ServiceTarget } from '@/lib/internal-client'

export interface AdminIdentity {
  id: string
  email: string
}

const target = (): ServiceTarget => ({
  name: 'booking-service',
  url: process.env.BOOKING_SERVICE_URL,
  key: process.env.BOOKING_SERVICE_INTERNAL_KEY ?? process.env.INTERNAL_API_KEY,
})

const who = (a: AdminIdentity) => ({ admin_id: a.id, admin_email: a.email })

export const bookingSvc = {
  cancel: (bookingId: string, admin: AdminIdentity, input: { reason: string; refundPercent: number }) =>
    callService<{ refund_amount: number; refund_percentage: number }>(
      target(), 'POST', `/internal/admin/bookings/${bookingId}/cancel`,
      { body: { ...who(admin), reason: input.reason, refund_percent: input.refundPercent } }
    ),

  overrideStatus: (bookingId: string, admin: AdminIdentity, input: { toStatus: string; reason: string }) =>
    callService(target(), 'POST', `/internal/admin/bookings/${bookingId}/override-status`, {
      body: { ...who(admin), to_status: input.toStatus, reason: input.reason },
    }),

  reassign: (bookingId: string, admin: AdminIdentity, input: { newWorkerId: string; reason: string }) =>
    callService(target(), 'POST', `/internal/admin/bookings/${bookingId}/reassign`, {
      body: { ...who(admin), new_worker_id: input.newWorkerId, reason: input.reason },
    }),

  escalate: (bookingId: string, admin: AdminIdentity, reason: string) =>
    callService<{ id: string }>(target(), 'POST', `/internal/admin/bookings/${bookingId}/escalate`, {
      body: { ...who(admin), reason },
    }),

  resolveDispute: (
    disputeId: string,
    admin: AdminIdentity,
    input: { resolution: string; note: string; refundAmount?: number }
  ) =>
    callService(target(), 'POST', `/internal/admin/disputes/${disputeId}/resolve`, {
      body: { ...who(admin), resolution: input.resolution, note: input.note, refund_amount: input.refundAmount },
    }),
}

export const couponSvc = {
  list: (query: Record<string, string | number | undefined>) =>
    callService<{ items: unknown[]; total: number; page: number; page_size: number }>(
      target(), 'GET', '/internal/admin/coupons', { query }),
  get: (id: string) => callService(target(), 'GET', `/internal/admin/coupons/${id}`),
  redemptions: (id: string, query: Record<string, string | number | undefined>) =>
    callService(target(), 'GET', `/internal/admin/coupons/${id}/redemptions`, { query }),
  create: (admin: AdminIdentity, body: object) =>
    callService(target(), 'POST', '/internal/admin/coupons', { body: { ...who(admin), ...body } }),
  batch: (admin: AdminIdentity, body: object) =>
    callService<{ batch_id: string; count: number; codes: string[] }>(
      target(), 'POST', '/internal/admin/coupons/batch', { body: { ...who(admin), ...body }, timeoutMs: 30_000 }),
  action: (id: string, action: string, admin: AdminIdentity, body: object = {}) =>
    callService(target(), 'POST', `/internal/admin/coupons/${id}/${action}`, { body: { ...who(admin), ...body } }),
}

export const promotionSvc = {
  list: (query: Record<string, string | number | undefined>) =>
    callService<{ items: unknown[]; total: number; page: number; page_size: number }>(
      target(), 'GET', '/internal/admin/promotions', { query }),
  get: (id: string) => callService(target(), 'GET', `/internal/admin/promotions/${id}`),
  settings: () => callService(target(), 'GET', '/internal/admin/promotions/settings'),
  updateSettings: (admin: AdminIdentity, body: object) =>
    callService(target(), 'PUT', '/internal/admin/promotions/settings', { body: { ...who(admin), ...body } }),
  /** approve | reject | pause | resume | end */
  action: (id: string, action: string, admin: AdminIdentity, body: object = {}) =>
    callService(target(), 'POST', `/internal/admin/promotions/${id}/${action}`, { body: { ...who(admin), ...body } }),
}

/** Promotional banners (customer app carousel). booking-service owns the rules and the visibility decision. */
export const bannerSvc = {
  list: (query: Record<string, string | number | undefined>) =>
    callService<{ items: unknown[]; total: number; page: number; page_size: number }>(
      target(), 'GET', '/internal/admin/banners', { query }),
  get: (id: string) => callService(target(), 'GET', `/internal/admin/banners/${id}`),
  create: (admin: AdminIdentity, body: object) =>
    callService(target(), 'POST', '/internal/admin/banners', { body: { ...who(admin), ...body } }),
  update: (id: string, admin: AdminIdentity, body: object) =>
    callService(target(), 'PATCH', `/internal/admin/banners/${id}`, { body: { ...who(admin), ...body } }),
  setEnabled: (id: string, admin: AdminIdentity, version: number, isEnabled: boolean) =>
    callService(target(), 'PATCH', `/internal/admin/banners/${id}/status`, {
      body: { ...who(admin), version, is_enabled: isEnabled },
    }),
  publish: (id: string, admin: AdminIdentity, version: number) =>
    callService(target(), 'POST', `/internal/admin/banners/${id}/publish`, { body: { ...who(admin), version } }),
  unpublish: (id: string, admin: AdminIdentity, version: number) =>
    callService(target(), 'POST', `/internal/admin/banners/${id}/unpublish`, { body: { ...who(admin), version } }),
  remove: (id: string, admin: AdminIdentity) =>
    callService<{ id: string; campaign_name: string }>(target(), 'DELETE', `/internal/admin/banners/${id}`, { body: who(admin) }),
  reorder: (admin: AdminIdentity, placement: string, ids: string[]) =>
    callService<{ items: unknown[] }>(target(), 'PATCH', '/internal/admin/banners/reorder', {
      body: { ...who(admin), placement, ids },
    }),
  placement: (code: string) => callService(target(), 'GET', `/internal/admin/banners/placements/${code}`),
  updatePlacement: (code: string, admin: AdminIdentity, body: object) =>
    callService(target(), 'PUT', `/internal/admin/banners/placements/${code}`, { body: { ...who(admin), ...body } }),
  uploadImage: (admin: AdminIdentity, file: Blob, filename: string) => {
    const form = new FormData()
    form.append('image', file, filename)
    return callService<{ url: string; public_id: string; width: number; height: number; bytes: number }>(
      target(), 'POST', '/internal/admin/banners/media', { form, headers: { 'x-admin-id': admin.id }, timeoutMs: 75_000 })
  },
}