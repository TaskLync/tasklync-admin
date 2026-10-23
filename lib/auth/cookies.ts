// lib/auth/cookies.ts  (edge-safe: middleware imports COOKIE from here)
import type { NextResponse } from 'next/server'
import { AUTH_CONFIG } from './config'

export const COOKIE = {
  access: 'admin_access',
  session: 'admin_session',   // refresh token
  device: 'admin_device',     // trusted-device token
  mfa: 'admin_mfa',           // short-lived MFA challenge
} as const

export const MFA_COOKIE_PATH = '/api/admin/auth/mfa'

const secure = process.env.NODE_ENV === 'production'
// Lax (not Strict) so opening an admin link from Slack/email keeps you logged in.
// CSRF on POST/PUT/DELETE is blocked by middleware's Origin check.
const base = { httpOnly: true, secure, sameSite: 'lax' as const }

export function setAccessCookie(res: NextResponse, accessToken: string) {
  res.cookies.set(COOKIE.access, accessToken, { ...base, path: '/', maxAge: AUTH_CONFIG.accessTtl })
}

/** maxAgeSeconds = null → browser-session cookie (ends when the browser closes). */
export function setSessionCookie(res: NextResponse, refreshToken: string, maxAgeSeconds: number | null) {
  res.cookies.set(COOKIE.session, refreshToken, {
    ...base,
    path: '/',
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds } : {}),
  })
}

export function setDeviceCookie(res: NextResponse, token: string, maxAgeSeconds: number) {
  res.cookies.set(COOKIE.device, token, { ...base, path: '/', maxAge: maxAgeSeconds })
}

export function setMfaTempCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE.mfa, token, { ...base, path: MFA_COOKIE_PATH, maxAge: AUTH_CONFIG.mfaTempTtl })
}

export function clearMfaTempCookie(res: NextResponse) {
  res.cookies.set(COOKIE.mfa, '', { ...base, path: MFA_COOKIE_PATH, maxAge: 0 })
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(COOKIE.access, '', { ...base, path: '/', maxAge: 0 })
  res.cookies.set(COOKIE.session, '', { ...base, path: '/', maxAge: 0 })
}

export function clearDeviceCookie(res: NextResponse) {
  res.cookies.set(COOKIE.device, '', { ...base, path: '/', maxAge: 0 })
}