// lib/payment-constants.ts
// Shared by server routes AND client components. No server-only imports here.

// ---------- payments.status (payment-service enum payment_status) ----------

export const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'HELD',
  'RELEASED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const

/** Ledger status = payments.status, or COD_COLLECTED for completed bookings with no payments row. */
export const LEDGER_STATUSES = [...PAYMENT_STATUSES, 'COD_COLLECTED'] as const
export type LedgerStatus = (typeof LEDGER_STATUSES)[number]

// ---------- payment_method_type ----------

export const PAYMENT_METHODS = [
  'JAZZCASH_WALLET',
  'JAZZCASH_CARD',
  'EASYPAISA_WALLET',
  'BANK_CARD',
  'RAAST',
  'IBFT',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const LEDGER_METHODS = [...PAYMENT_METHODS, 'COD'] as const
export type LedgerMethod = (typeof LEDGER_METHODS)[number]

// ---------- payouts / refunds ----------

export const PAYOUT_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

export const REFUND_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const
export type RefundStatus = (typeof REFUND_STATUSES)[number]

export const REFUND_REASONS = [
  'BOOKING_CANCELLED_BEFORE_ACCEPT',
  'BOOKING_CANCELLED_AFTER_ACCEPT',
  'BOOKING_CANCELLED_LATE',
  'DISPUTE_RESOLVED_REFUND',
  'DISPUTE_RESOLVED_PARTIAL',
  'ADMIN_MANUAL_REFUND',
] as const
export type RefundReason = (typeof REFUND_REASONS)[number]

/** refunds has no "initiated by user/worker" column: admin = initiated_by set, system = everything else. */
export const REFUND_INITIATORS = ['admin', 'system'] as const

/** Statuses an admin may refund from the ledger. payment-service has the final say. */
export const REFUNDABLE_STATUSES: readonly string[] = ['HELD', 'RELEASED', 'PARTIALLY_REFUNDED']

// ---------- reports + tabs ----------

export const REPORT_TYPES = [
  'monthly-revenue',
  'transactions',
  'payouts',
  'tax-summary',
  'city-value',
] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export const PAYMENT_TABS = ['overview', 'transactions', 'payouts', 'refunds', 'reports'] as const
export type PaymentTab = (typeof PAYMENT_TABS)[number]

export const COMPLETED_BOOKING_STATUSES = ['COMPLETED', 'AUTO_COMPLETED'] as const