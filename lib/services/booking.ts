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