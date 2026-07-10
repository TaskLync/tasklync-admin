// types/user.ts

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'banned' | 'deleted'

export interface UserListItem {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  city: string | null
  totalBookings: number
  isActive: boolean
  status: UserStatus
  hasDispute: boolean
  createdAt: string
}

export interface UserListResponse {
  data: UserListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface UserFilters {
  search: string
  city: string | 'all'
  status: UserStatus | 'all'
  bookingsBucket: '0' | '1-5' | '5-20' | '20+' | 'all'
  hasDispute: 'yes' | 'no' | 'all'
  dateFrom: string | null
  dateTo: string | null
  sortBy: 'created_at' | 'name' | 'total_bookings'
  sortDir: 'asc' | 'desc'
  page: number
  pageSize: number
}

export interface UserAddress {
  id: string
  label: string
  addressLine: string
  city: string | null
  country: string | null
  isDefault: boolean
  createdAt: string
}

export interface BlockedWorker {
  id: string
  blockedWorkerId: string
  workerName: string | null
  workerPhone: string | null
  workerCategory: string | null
  createdAt: string
}

export interface UserBookingRow {
  id: string
  workerName: string | null
  category: string | null
  status: string
  amount: number | null
  scheduledAt: string | null
  createdAt: string
}

export interface UserReviewRow {
  id: string
  workerName: string | null
  rating: number
  comment: string | null
  isFlagged: boolean
  createdAt: string
}

export interface UserReportRow {
  id: string
  direction: 'filed_by_user' | 'filed_against_user'
  counterpartyName: string | null
  reason: string
  status: string
  createdAt: string
}

export interface AvailabilityAwareList<T> {
  available: boolean
  data: T[]
}

export interface UserDetail {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  preferredLanguage: string
  preferredCurrency: string
  totalBookings: number
  isActive: boolean
  role: string
  status: UserStatus
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  pushEnabled: boolean
  emailEnabled: boolean
  suspendedUntil: string | null
  suspendedReason: string | null
  bannedAt: string | null
  bannedReason: string | null
  warningCount: number
  lastWarningAt: string | null
  lastWarningReason: string | null
  defaultCity: string | null
  addressCount: number
  blockedWorkerCount: number
}
