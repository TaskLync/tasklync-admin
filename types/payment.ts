// types/payment.ts
import type {
  LedgerMethod,
  LedgerStatus,
  PayoutStatus,
  RefundReason,
  RefundStatus,
} from '@/lib/payment-constants'

export type { LedgerMethod, LedgerStatus, PayoutStatus, RefundReason, RefundStatus }

// ---- Overview ----

export type OverviewPeriod = 'mtd' | 'ytd'

export interface PaymentAttention {
  failedPayments: number
  failedPayouts: number
  failedRefunds: number
  stalePendingRefunds: number
  deadLetters7d: number
}

export interface MethodBreakdownRow {
  method: LedgerMethod
  bookings: number
  gross: number
}

export interface PaymentOverview {
  period: OverviewPeriod
  currency: string
  grossRevenue: number
  platformFees: number
  completedBookings: number
  workerPayoutsPaid: number
  payoutsInFlight: number
  escrowHeld: number
  escrowCount: number
  refundsIssued: number
  refundsPending: number
  walletBalance: number
  walletPending: number
  grossSparkline7d: number[]
  feesSparkline7d: number[]
  byMethod: MethodBreakdownRow[]
  attention: PaymentAttention
}

export interface RevenuePoint {
  date: string
  gross: number
  fees: number
  workerAmount: number
}

export interface CityRevenueRow {
  city: string
  bookings: number
  gross: number
  fees: number
}

export interface RevenueSeries {
  days: number
  chart: RevenuePoint[]
  byCity: CityRevenueRow[]
}

// ---- Lists ----

export interface ListResponse<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface TransactionRow {
  bookingId: string
  paymentId: string | null
  userId: string | null
  userName: string | null
  userPhone: string | null
  workerId: string | null
  workerName: string | null
  workerPhone: string | null
  city: string | null
  gross: number
  platformFee: number
  workerAmount: number
  currency: string
  method: LedgerMethod
  status: LedgerStatus
  gatewayTransactionId: string | null
  gatewayOrderId: string | null
  failureReason: string | null
  refunded: number
  /** gross - refunded, 0 when the row can't be refunded from the admin panel */
  refundable: number
  txnAt: string
}

export interface TransactionList extends ListResponse<TransactionRow> {
  totals: { gross: number; platformFee: number; workerAmount: number }
}

export interface PayoutRow {
  id: string
  workerId: string
  workerName: string | null
  workerPhone: string | null
  paymentId: string | null
  bookingId: string | null
  amount: number
  currency: string
  method: string
  /** masked on the server */
  destination: string
  status: PayoutStatus
  gatewayReference: string | null
  failureReason: string | null
  initiatedAt: string
  completedAt: string | null
}

export interface RefundRow {
  id: string
  paymentId: string
  bookingId: string
  userId: string
  userName: string | null
  userPhone: string | null
  amount: number
  percentage: number
  reason: RefundReason
  status: RefundStatus
  method: string
  /** masked on the server */
  destination: string
  gatewayReference: string | null
  failureReason: string | null
  initiatedBy: 'admin' | 'system'
  adminName: string | null
  initiatedAt: string
  completedAt: string | null
}

// ---- Filters ----

export interface TransactionFilters {
  search: string
  status: LedgerStatus | 'all'
  method: LedgerMethod | 'all'
  city: string | 'all'
  amountMin: string
  amountMax: string
  dateFrom: string | null
  dateTo: string | null
  page: number
  pageSize: number
}

export interface PayoutFilters {
  search: string
  status: PayoutStatus | 'all'
  method: string | 'all'
  dateFrom: string | null
  dateTo: string | null
  page: number
  pageSize: number
}

export interface RefundFilters {
  search: string
  status: RefundStatus | 'all'
  reason: RefundReason | 'all'
  initiatedBy: 'admin' | 'system' | 'all'
  dateFrom: string | null
  dateTo: string | null
  page: number
  pageSize: number
}