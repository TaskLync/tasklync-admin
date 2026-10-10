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
  'waitlist:view': ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT'],
  'waitlist:manage': ['SUPER_ADMIN', 'OPS'], // status changes (pending → invited → converted)

  // Users moderation
  'users:warn': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'users:suspend': ['SUPER_ADMIN', 'OPS'],
  'users:ban': ['SUPER_ADMIN'],
  'users:edit': ['SUPER_ADMIN', 'OPS'],
  'users:impersonate': ['SUPER_ADMIN'],

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
  'disputes:resolve': ['SUPER_ADMIN', 'OPS'], // escalated disputes: SUPER_ADMIN only, enforced in the resolve route
  'disputes:assign': ['SUPER_ADMIN', 'OPS', 'SUPPORT'], // claim / release
  'disputes:escalate': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'disputes:note': ['SUPER_ADMIN', 'OPS', 'SUPPORT'], // internal notes
}

// Maps URL path prefixes -> required permission, used by middleware.ts
// NOTE: order matters. permissionForPath uses find() + startsWith, so more specific prefixes must come first.
export const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: '/workers/verification', permission: 'workers:verify' }, // must stay above '/workers'
  { prefix: '/workers', permission: 'workers:view' },
  { prefix: '/users', permission: 'users:view' },
  { prefix: '/bookings', permission: 'bookings:view' },
  { prefix: '/payments', permission: 'payments:view' },
  { prefix: '/disputes', permission: 'disputes:view' },
  { prefix: '/analytics', permission: 'analytics:view' },
  { prefix: '/categories', permission: 'categories:view' },
  { prefix: '/settings', permission: 'settings:view' },
]

export function hasPermission(role: AdminRole, permission: string): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false
}

export function permissionForPath(pathname: string): string | null {
  const match = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix))
  return match?.permission ?? null
}