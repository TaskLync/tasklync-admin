// lib/auth/uuid-guard.ts  (edge safe)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// entity prefix -> static sub-routes that are NOT an id
const GUARDS: { prefix: string; statics: string[] }[] = [
  { prefix: '/api/admin/users/', statics: ['kpis', 'export'] },
  { prefix: '/api/admin/workers/', statics: ['kpis', 'export', 'filter-options', 'verification'] },
  { prefix: '/api/admin/bookings/', statics: ['kpis', 'export', 'board'] },
  { prefix: '/api/admin/disputes/', statics: ['counts', 'refunds'] },
  { prefix: '/api/admin/reviews/', statics: ['counts', 'audit'] },
  { prefix: '/api/admin/payments/payouts/', statics: [] },
  { prefix: '/api/admin/notifications/campaigns/', statics: [] },
  { prefix: '/api/admin/admins/', statics: [] },
  { prefix: '/api/admin/coupons/', statics: ['batch'] },
  { prefix: '/api/admin/promotions/', statics: ['settings'] },
  { prefix: '/api/admin/ranking/overrides/', statics: [] },
]

/** true when the path has an id segment that is not a UUID. */
export function hasInvalidIdSegment(pathname: string): boolean {
  for (const g of GUARDS) {
    if (!pathname.startsWith(g.prefix)) continue
    const segment = pathname.slice(g.prefix.length).split('/')[0]
    if (!segment || g.statics.includes(segment)) return false
    return !UUID_RE.test(segment)
  }
  return false
}