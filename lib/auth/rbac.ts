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
  'disputes:view': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'disputes:resolve': ['SUPER_ADMIN', 'OPS'],
  'analytics:view': ['SUPER_ADMIN', 'OPS', 'FINANCE'],
  'settings:view': ['SUPER_ADMIN'],
  'settings:edit': ['SUPER_ADMIN'],
  'admin_users:manage': ['SUPER_ADMIN'],
  'waitlist:view':   ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT'],
  'waitlist:manage': ['SUPER_ADMIN', 'OPS'], // status changes (pending → invited → converted)
  'users:warn':          ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  'users:suspend':       ['SUPER_ADMIN', 'OPS'],
  'users:ban':           ['SUPER_ADMIN'],
  'users:edit':          ['SUPER_ADMIN', 'OPS'],
  'users:impersonate':   ['SUPER_ADMIN'],
}

// Maps URL path prefixes -> required permission, used by middleware.ts
export const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: '/workers', permission: 'workers:view' },
  { prefix: '/users', permission: 'users:view' },
  { prefix: '/bookings', permission: 'bookings:view' },
  { prefix: '/payments', permission: 'payments:view' },
  { prefix: '/disputes', permission: 'disputes:view' },
  { prefix: '/analytics', permission: 'analytics:view' },
  { prefix: '/settings', permission: 'settings:view' },
]

export function hasPermission(role: AdminRole, permission: string): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false
}

export function permissionForPath(pathname: string): string | null {
  const match = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix))
  return match?.permission ?? null
}