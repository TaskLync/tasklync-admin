// lib/analytics-constants.ts
// Shared by server routes AND client components. No server-only imports here.
import type { AnalyticsRange } from '@/types/analytics'

export const ANALYTICS_RANGES = [7, 30, 90] as const
export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = 30

export function parseRange(value: string | null | undefined): AnalyticsRange {
  const n = Number(value)
  return (ANALYTICS_RANGES as readonly number[]).includes(n)
    ? (n as AnalyticsRange)
    : DEFAULT_ANALYTICS_RANGE
}

export const GROWTH_TABS = ['people', 'bookings', 'revenue', 'cities'] as const
export type GrowthTab = (typeof GROWTH_TABS)[number]

export const GROWTH_TAB_LABEL: Record<GrowthTab, string> = {
  people: 'Users & Workers',
  bookings: 'Bookings',
  revenue: 'Revenue',
  cities: 'Cities',
}

export const CITY_METRICS = ['bookings', 'gross', 'activeWorkers'] as const
export type CityMetric = (typeof CITY_METRICS)[number]

export const CITY_METRIC_LABEL: Record<CityMetric, string> = {
  bookings: 'Bookings',
  gross: 'Revenue',
  activeWorkers: 'Active workers',
}

/** Same palette as the Waitlist charts. */
export const CHART_COLORS = ['#1F6F5F', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#6B7280']