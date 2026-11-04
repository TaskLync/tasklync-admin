import { describe, it, expect } from 'vitest'
import { hasPermission, permissionForPath } from '@/lib/auth/rbac'

describe('rbac', () => {
  it('impersonation is gone for everyone', () => {
    expect(hasPermission('SUPER_ADMIN', 'users:impersonate')).toBe(false)
  })
  it('verification path is stricter than workers', () => {
    expect(permissionForPath('/workers/verification/abc')).toBe('workers:verify')
    expect(permissionForPath('/workers/abc')).toBe('workers:view')
  })
  it('settings/admins is checked before settings', () => {
    expect(permissionForPath('/settings/admins')).toBe('admin_users:manage')
    expect(permissionForPath('/settings')).toBe('settings:view')
  })
  it('waitlist follows the nav (SUPER_ADMIN, OPS)', () => {
    expect(permissionForPath('/waitlist')).toBe('waitlist:view')
    expect(hasPermission('OPS', 'waitlist:view')).toBe(true)
    expect(hasPermission('FINANCE', 'waitlist:view')).toBe(false)
  })
  it('only super admin edits pricing', () => {
    expect(hasPermission('OPS', 'settings:edit')).toBe(false)
    expect(hasPermission('SUPER_ADMIN', 'settings:edit')).toBe(true)
  })
    it('coupons: view for all, create and manage for SUPER_ADMIN and OPS, approval for SUPER_ADMIN and FINANCE', () => {
    expect(hasPermission('SUPPORT', 'coupons:view')).toBe(true)
    expect(hasPermission('SUPPORT', 'coupons:create')).toBe(false)
    expect(hasPermission('OPS', 'coupons:manage')).toBe(true)
    expect(hasPermission('OPS', 'coupons:approve-high')).toBe(false)
    expect(hasPermission('FINANCE', 'coupons:approve-high')).toBe(true)
    expect(hasPermission('FINANCE', 'coupons:create')).toBe(false)
    expect(permissionForPath('/coupons/abc')).toBe('coupons:view')
  })
})