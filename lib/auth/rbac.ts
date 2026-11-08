import type { AdminRole } from '@/types/auth'
export type { AdminRole }

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OPS: 'OPS',
  FINANCE: 'FINANCE',
  SUPPORT: 'SUPPORT',
} as const

export const PERMISSIONS: Record<string, AdminRole[]> = {
  'dashboard:view': ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT'],
  'workers:view': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'workers:verify': ['SUPER_ADMIN', 'OPS'],
  'users:view': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'bookings:view': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'payments:view': ['SUPER_ADMIN', 'FINANCE'],
  'analytics:view': ['SUPER_ADMIN', 'OPS', 'FINANCE'],
  'settings:view': ['SUPER_ADMIN'],
  'settings:edit': ['SUPER_ADMIN'],
  'admin_users:manage': ['SUPER_ADMIN'],
  // Same set as the sidebar entry, so the page and the nav can never disagree.
  'waitlist:view': ['SUPER_ADMIN', 'OPS'],
  'waitlist:manage': ['SUPER_ADMIN', 'OPS'],

  // Users moderation (impersonation removed)
  'users:warn': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'users:suspend': ['SUPER_ADMIN', 'OPS'],
  'users:ban': ['SUPER_ADMIN'],
  'users:edit': ['SUPER_ADMIN', 'OPS'],

  // Categories & Services
  'categories:view': ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT'],
  'categories:create': ['SUPER_ADMIN'],
  'categories:edit': ['SUPER_ADMIN'],
  'services:edit': ['SUPER_ADMIN'],

  // Workers moderation
  'workers:warn': ['SUPER_ADMIN', 'OPS'],
  'workers:suspend': ['SUPER_ADMIN', 'OPS'],
  'workers:ban': ['SUPER_ADMIN'],
  'workers:edit': ['SUPER_ADMIN', 'OPS'],
  'workers:feature': ['SUPER_ADMIN', 'OPS'],
  'workers:badge': ['SUPER_ADMIN', 'OPS'],
  'workers:force-offline': ['SUPER_ADMIN', 'OPS'],

  // Bookings actions
  'bookings:cancel': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'bookings:override': ['SUPER_ADMIN', 'OPS'],
  'bookings:reassign': ['SUPER_ADMIN', 'OPS'],
  'bookings:escalate': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'bookings:note': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],

  // Payments & finance
  'payments:refund': ['SUPER_ADMIN', 'FINANCE'],
  'payments:payout': ['SUPER_ADMIN', 'FINANCE'],
  'payments:export': ['SUPER_ADMIN', 'FINANCE'],

  // Disputes
  'disputes:view': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'disputes:resolve': ['SUPER_ADMIN', 'OPS'], // escalated: SUPER_ADMIN only, enforced in the route
  'disputes:assign': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'disputes:escalate': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'disputes:note': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],

  // Notifications
  'notifications:view': ['SUPER_ADMIN', 'OPS'],
  'notifications:send': ['SUPER_ADMIN', 'OPS'],
  'notifications:broadcast-all': ['SUPER_ADMIN'],

  // Live map
  'map:view': ['SUPER_ADMIN', 'OPS'],

  // Reviews & ratings
  'reviews:view': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'reviews:moderate': ['SUPER_ADMIN', 'OPS'],
  'reviews:note': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],

    // Coupons (rules live in booking-service)
  'coupons:view': ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT'],
  'coupons:create': ['SUPER_ADMIN', 'OPS'],
  'coupons:manage': ['SUPER_ADMIN', 'OPS'],           // pause, resume, end, extend
  'coupons:approve-high': ['SUPER_ADMIN', 'FINANCE'], // second approver for uncapped / high budget coupons

  // Promotions (worker-funded offers, rules live in booking-service)
  'promotions:view': ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT'],
  'promotions:approve': ['SUPER_ADMIN', 'OPS'],   // approve, reject
  'promotions:suspend': ['SUPER_ADMIN', 'OPS'],   // pause, resume, end
  'settings:promotions': ['SUPER_ADMIN'],         // guardrails

  // Ranking (policy lives in search-service, facts in worker-service)
  'ranking:view': ['SUPER_ADMIN', 'OPS'],
  'ranking:flag': ['SUPER_ADMIN', 'OPS'],         // worker ranking flags
  'ranking:config': ['SUPER_ADMIN'],              // versions, activate, shadow, overrides, simulate
}

// Path prefix -> permission, used by middleware.ts. Order matters (find() + startsWith): specific before general.
export const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: '/workers/verification', permission: 'workers:verify' }, // above '/workers'
  { prefix: '/workers', permission: 'workers:view' },
  { prefix: '/users', permission: 'users:view' },
  { prefix: '/bookings', permission: 'bookings:view' },
  { prefix: '/payments', permission: 'payments:view' },
  { prefix: '/disputes', permission: 'disputes:view' },
  { prefix: '/notifications', permission: 'notifications:view' },
  { prefix: '/analytics', permission: 'analytics:view' },
  { prefix: '/categories', permission: 'categories:view' },
  { prefix: '/settings/ranking', permission: 'ranking:view' }, // above '/settings/admins' and '/settings'
  { prefix: '/settings/admins', permission: 'admin_users:manage' }, // above '/settings'
  { prefix: '/settings', permission: 'settings:view' },
  { prefix: '/map', permission: 'map:view' },
  { prefix: '/reviews', permission: 'reviews:view' },
  { prefix: '/coupons', permission: 'coupons:view' },
  { prefix: '/promotions', permission: 'promotions:view' },
  { prefix: '/waitlist', permission: 'waitlist:view' },
]

export function hasPermission(role: AdminRole, permission: string): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false
}

export function permissionForPath(pathname: string): string | null {
  const match = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix))
  return match?.permission ?? null
}