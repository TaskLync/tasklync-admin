export type AdminRole = 'SUPER_ADMIN' | 'OPS' | 'FINANCE' | 'SUPPORT'

export interface AdminUser {
  id: string
  email: string
  fullName: string
  role: AdminRole
  isActive: boolean
  mfaEnabled: boolean
}

export interface AccessTokenPayload {
  sub: string          // admin id
  email: string
  role: AdminRole
  sessionId: string
  type: 'access'
}

export interface MfaTempTokenPayload {
  sub: string
  purpose: 'mfa_pending'
  type: 'mfa_temp'
}

export interface SessionRecord {
  adminId: string
  email: string
  role: AdminRole
  createdAt: string
  ip: string
}