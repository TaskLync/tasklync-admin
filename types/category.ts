// types/category.ts

export type PriceType = 'fixed' | 'hourly' | 'quote'

export interface CategoryListItem {
  id: string                 // VARCHAR(50) slug, e.g. "electrician"
  name: string
  nameUr: string | null
  iconUrl: string | null
  parentId: string | null
  isActive: boolean
  sortOrder: number
  serviceCount: number
  activeWorkerCount: number
  createdAt: string
}

export interface CategoryListResponse {
  data: CategoryListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CategoryFilters {
  search: string
  status: 'all' | 'active' | 'inactive'
  sortBy: 'sort_order' | 'name' | 'active_workers'
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export interface CategoryKpis {
  totalCategories: number
  activeCategories: number
  totalServices: number
  categoriesWithNoActiveWorkers: number
}

export interface CategoryDetail extends CategoryListItem {}

export interface CategoryFormInput {
  id?: string                // required on create only; immutable after creation
  name: string
  nameUr?: string | null
  iconUrl?: string | null
  parentId?: string | null
  sortOrder?: number
}

export interface ServiceItem {
  id: string                 // UUID
  categoryId: string
  name: string
  nameUr: string | null
  description: string | null
  basePrice: number | null
  priceType: PriceType
  minDurationMins: number
  iconUrl: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface ServiceFormInput {
  name: string
  nameUr?: string | null
  description?: string | null
  basePrice: number | null
  priceType: PriceType
  minDurationMins: number
  iconUrl?: string | null
  sortOrder?: number
}

export type TaxAppliesTo = 'subtotal' | 'subtotal_and_fee'

/** Live fee / commission / tax configuration (platform_pricing_config), read by booking-service. */
export interface PricingConfig {
  customerFeeEnabled: boolean
  customerFeePercent: number
  workerCommissionEnabled: boolean
  workerCommissionPercent: number
  taxEnabled: boolean
  taxPercent: number
  taxLabel: string
  taxAppliesTo: TaxAppliesTo
  /** Customer cancellation fees (share of the total kept). Cancelling before the worker accepts is always free. */
  cancellationFeesEnabled: boolean
  cancelFeeOver24hPercent: number
  cancelFeeWithin24hPercent: number
  cancelFeeAfterArrivalPercent: number
  /** Fee recorded when the worker reports a customer no-show (capped at the booking total). */
  noShowFeeEnabled: boolean
  noShowFeePkr: number
  /** informational: effective customer fee + effective worker commission */
  platformFeePercent: number
  demandThreshold: number
  demandMultiplier: number
  offPeakMultiplier: number
  version: number
  effectiveFrom: string
  updatedAt: string
}

export interface PricingConfigInput {
  customerFeeEnabled: boolean
  customerFeePercent: number
  workerCommissionEnabled: boolean
  workerCommissionPercent: number
  taxEnabled: boolean
  taxPercent: number
  taxLabel: string
  taxAppliesTo: TaxAppliesTo
  cancellationFeesEnabled: boolean
  cancelFeeOver24hPercent: number
  cancelFeeWithin24hPercent: number
  cancelFeeAfterArrivalPercent: number
  noShowFeeEnabled: boolean
  noShowFeePkr: number
  demandThreshold: number
  demandMultiplier: number
  offPeakMultiplier: number
  /** Version the admin was looking at; a newer saved version makes the save fail (409) instead of overwriting it. */
  expectedVersion: number
  /** Optional note stored in the configuration history. */
  reason?: string
}

export interface PricingConfigHistoryEntry {
  version: number
  changedAt: string
  changedByEmail: string | null
  reason: string | null
  customerFeePercent: number
  customerFeeEnabled: boolean
  workerCommissionPercent: number
  workerCommissionEnabled: boolean
  taxEnabled: boolean
  taxPercent: number
  cancellationFeesEnabled: boolean
  noShowFeeEnabled: boolean
}