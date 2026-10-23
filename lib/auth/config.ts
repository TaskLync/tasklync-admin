// lib/auth/config.ts
// Single source of truth for every auth timing/limit. Edge-safe (no node imports).

function num(value: string | undefined, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const DAY = 24 * 60 * 60

export const AUTH_CONFIG = {
  issuer: 'tasklync-admin',
  audience: 'tasklync-admin-panel',
  mfaAudience: 'tasklync-admin-mfa',

  accessTtl: num(process.env.ADMIN_ACCESS_TOKEN_TTL, 900),
  sessionRememberTtl: num(process.env.ADMIN_SESSION_REMEMBER_TTL, 7 * DAY),
  sessionShortTtl: num(process.env.ADMIN_SESSION_SHORT_TTL, 8 * 3600),
  mfaSetupSessionTtl: 30 * 60,
  trustedDeviceTtl: num(process.env.ADMIN_TRUSTED_DEVICE_TTL, 7 * DAY),
  mfaTempTtl: num(process.env.ADMIN_MFA_TEMP_TOKEN_TTL, 300),
  refreshGraceSeconds: num(process.env.ADMIN_REFRESH_GRACE_SECONDS, 20),

  maxFailedAttempts: num(process.env.ADMIN_MAX_FAILED_ATTEMPTS, 5),
  lockoutMinutes: num(process.env.ADMIN_LOCKOUT_MINUTES, 30),
  maxConcurrentSessions: num(process.env.ADMIN_MAX_CONCURRENT_SESSIONS, 3),
  mfaMaxAttempts: 5,

  mfaRequired: process.env.ADMIN_MFA_REQUIRED !== 'false',
} as const