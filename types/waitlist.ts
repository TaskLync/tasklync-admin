// types/waitlist.ts

export type WaitlistStatus = 'pending' | 'invited' | 'converted'

export interface WaitlistEntry {
  id: string
  email: string
  position: number
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  ip_address: string | null
  user_agent: string | null
  status: WaitlistStatus
  created_at: string
  updated_at: string
}

export interface WaitlistEntryEnriched extends WaitlistEntry {
  is_bot: boolean
  device_type: string
  browser: string
  os: string
}

export interface WaitlistKpis {
  total_signups: number
  signups_today: number
  signups_today_change_pct: number
  signups_this_week: number
  signups_this_week_change_pct: number
  pending_count: number
  invited_count: number
  converted_count: number
  conversion_rate: number
  top_utm_source: string | null
  sparkline_7d: number[]
}

export type WaitlistGrowthPeriod = 'daily' | 'weekly' | 'monthly'

export interface WaitlistGrowthPoint {
  bucket: string
  signups: number
  cumulative: number
}

export interface WaitlistGrowthResponse {
  chart: WaitlistGrowthPoint[]
  period: WaitlistGrowthPeriod
}

export interface UtmBreakdownRow {
  utm_source: string | null
  count: number
  pct: number
}

export interface UtmBreakdownResponse {
  rows: UtmBreakdownRow[]
  total: number
}

export interface DeviceBreakdownRow {
  label: string
  count: number
  pct: number
}

export interface DeviceBreakdownResponse {
  device: DeviceBreakdownRow[]
  browser: DeviceBreakdownRow[]
  os: DeviceBreakdownRow[]
  sampledFrom: number
}

export interface WaitlistListResponse {
  rows: WaitlistEntryEnriched[]
  total: number
  page: number
  pageSize: number
}

export interface WaitlistFilters {
  search?: string
  status?: WaitlistStatus | 'all'
  utm_source?: string | 'all'
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'position' | 'email'
  sortDir?: 'asc' | 'desc'
}