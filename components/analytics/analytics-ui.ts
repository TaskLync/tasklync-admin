// components/analytics/analytics-ui.ts
// Formatters shared by every analytics component.

export { formatPkr } from '@/components/bookings/booking-ui'

/** "YYYY-MM-DD" (already a Karachi calendar day) -> "10 Oct". Noon avoids any timezone day-shift. */
export function fmtDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
}

export const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }
export const AXIS_TICK = { fontSize: 11, fill: '#9CA3AF' }

/** Compact axis labels for money: 1.2k, 3.4M. */
export function compact(n: number): string {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}