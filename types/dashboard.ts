// types/dashboard.ts

export interface KpiSparkPoint {
  day: string
  day_total: number
}

export interface DashboardKpis {
  revenueToday: number
  revenueYesterday: number
  revenueSparkline: KpiSparkPoint[]
  activeBookingsNow: number
  activeBookingsSparkline: KpiSparkPoint[]
  newSignupsToday: number
  newSignupsYesterday: number
  signupsSparkline: KpiSparkPoint[]
  pendingVerifications: number
  pendingVerificationsSparkline: KpiSparkPoint[]
}

export interface AttentionDispute {
  id: string
  bookingId: string
  ageHours: number
}
export interface AttentionVerification {
  id: string
  name: string
  category: string
  ageHours: number
}
export interface AttentionFailedPayment {
  id: string
  bookingId: string
  amount: number
}
export interface AttentionStuckBooking {
  id: string
  city: string
  category: string
  ageMinutes: number
}
export interface AttentionFlaggedReview {
  id: string
  bookingId: string
}

export interface NeedsAttention {
  staleDisputes: AttentionDispute[]
  staleVerifications: AttentionVerification[]
  failedPayments: AttentionFailedPayment[]
  stuckPendingBookings: AttentionStuckBooking[]
  flaggedReviews: AttentionFlaggedReview[]
}

export type PlatformEventType =
  | 'booking.created'
  | 'worker.verified'
  | 'payment.completed'
  | 'booking.disputed'
  | 'user.registered'

export interface PlatformEvent {
  id: string
  event_type: PlatformEventType
  message: string
  metadata: Record<string, string>
  created_at: string
}

export type RevenuePeriod = 'daily' | 'weekly' | 'monthly'

export interface RevenueChartPoint {
  bucket: string
  gross_revenue: number
  platform_fees: number
}

export interface CityRevenue {
  city: string
  gross_revenue: number
  bookings_count: number
}

export interface FunnelStage {
  stage: 'Created' | 'Accepted' | 'Started' | 'Completed'
  count: number
  pct: number
}