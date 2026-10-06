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

export interface PricingConfig {
  platformFeePercent: number
  demandThreshold: number
  demandMultiplier: number
  urgencySameDayMultiplier: number
  urgencyWithin2hMultiplier: number
  offPeakMultiplier: number
  updatedAt: string
}

export interface PricingConfigInput {
  platformFeePercent: number
  demandThreshold: number
  demandMultiplier: number
  urgencySameDayMultiplier: number
  urgencyWithin2hMultiplier: number
  offPeakMultiplier: number
}