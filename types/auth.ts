export type AdminRole = 'SUPER_ADMIN' | 'OPS' | 'FINANCE' | 'SUPPORT'

// 'full'      = password + MFA satisfied
// 'mfa_setup' = password only, may ONLY reach the MFA enrolment page/API
export type AccessScope = 'full' | 'mfa_setup'

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
  sessionId: string    // random session id (NOT the refresh token)
  scope: AccessScope
  type: 'access'
}

export interface MfaTempTokenPayload {
  sub: string
  jti: string
  purpose: 'mfa_pending'
  type: 'mfa_temp'
}

export interface SessionRecord {
  sid: string
  adminId: string
  email: string
  role: AdminRole
  createdAt: string
  expiresAt: number        // absolute expiry, epoch ms. Never extended by refresh.
  ip: string
  userAgent: string
  remember: boolean
  mfaVerified: boolean
  rtHash: string           // sha256 of the current refresh token
}