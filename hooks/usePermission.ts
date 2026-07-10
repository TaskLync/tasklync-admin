'use client'

import { useAdminSession } from './useAdminSession'
import { hasPermission } from '@/lib/auth/rbac'

export function usePermission(permission: string): boolean {
  const { admin } = useAdminSession()
  if (!admin) return false
  return hasPermission(admin.role, permission)
}