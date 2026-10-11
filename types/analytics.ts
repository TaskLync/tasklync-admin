// types/analytics.ts

export type AnalyticsRange = 7 | 30 | 90

/**
 * One KPI card.
 * `change` is a % change for counts and money, and a percentage-POINT change for rates.
 */
export interface KpiMetric {
  value: number | null
  previous: number | null
  change: number | null
  sparkline: number[]
}

export interface AnalyticsKpis {
  currency: string
  dau: KpiMetric
  daw: KpiMetric
  completionRate: KpiMetric
  avgBookingValue: KpiMetric
  acceptanceRate: KpiMetric
  retention: KpiMetric & { cohortSize: number }
}

export interface GrowthPoint {
  /** YYYY-MM-DD, Asia/Karachi */
  date: string
  newUsers: number
  newWorkers: number
  bookingsCreated: number
  bookingsCompleted: number
  bookingsCancelled: number
  gross: number
  grossMa7: number
}

export type CityTrendRow = { date: string } & Record<string, number | string>

export interface AnalyticsGrowth {
  days: AnalyticsRange
  series: GrowthPoint[]
  cityTrend: { cities: string[]; rows: CityTrendRow[] }
}

export interface FunnelStage {
  stage: string
  count: number
  /** % of the first stage */
  pctOfStart: number
  /** % lost since the previous stage (0 for the first stage) */
  dropOffPct: number
}

export interface AnalyticsFunnels {
  days: AnalyticsRange
  user: FunnelStage[]
  worker: FunnelStage[]
}

export interface CityPerformanceRow {
  city: string
  bookings: number
  completed: number
  completionRate: number | null
  gross: number
  activeWorkers: number
  bookingsPerWorker: number | null
}

export interface AnalyticsCities {
  days: AnalyticsRange
  data: CityPerformanceRow[]
}

export interface CategoryPerformanceRow {
  categoryId: string
  categoryName: string
  bookings: number
  completed: number
  completionRate: number | null
  cancellationRate: number | null
  avgValue: number | null
  avgWorkerRating: number | null
  topWorker: { id: string; name: string | null; jobs: number } | null
}

export interface AnalyticsCategories {
  days: AnalyticsRange
  data: CategoryPerformanceRow[]
}