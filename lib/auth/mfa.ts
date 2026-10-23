// lib/auth/mfa.ts
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { redis } from '@/lib/redis'
import { verifyPassword } from './password'
import { hmacBackupCode, safeEqual } from './crypto'

// Accept the previous/next 30s step to survive phone clock drift.
authenticator.options = { window: 1 }

export function generateMfaSecret() {
  return authenticator.generateSecret()
}

export async function generateMfaQrCode(email: string, secret: string): Promise<string> {
  const otpauth = authenticator.keyuri(email, 'Tasklync Admin', secret)
  return QRCode.toDataURL(otpauth)
}

export function verifyTotp(code: string, secret: string): boolean {
  if (!/^\d{6}$/.test(code)) return false
  try {
    return authenticator.check(code, secret)
  } catch {
    return false
  }
}

/** Replay protection: a TOTP code can be used once. Returns false if it was already used. */
export async function claimTotpCode(adminId: string, code: string): Promise<boolean> {
  const res = await redis.set(`admin:totp_used:${adminId}:${code}`, '1', 'EX', 120, 'NX')
  return res === 'OK'
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-')
  )
}

/** "ab12c-d34ef", "AB12CD34EF", "ab12c d34ef" -> "AB12C-D34EF". Returns null if not a backup code. */
export function normalizeBackupCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[^A-F0-9]/g, '')
  if (c.length !== 10) return null
  return `${c.slice(0, 5)}-${c.slice(5)}`
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return codes.map((c) => hmacBackupCode(c))
}

/** Returns the index of the matching hash, or -1. Supports legacy bcrypt hashes. */
export async function verifyBackupCode(code: string, hashes: string[]): Promise<number> {
  const candidate = hmacBackupCode(code)
  for (let i = 0; i < hashes.length; i++) {
    const h = hashes[i]
    if (h.startsWith('hmac1:')) {
      if (safeEqual(h, candidate)) return i
    } else if (h.startsWith('$2')) {
      if (await verifyPassword(code, h)) return i
    }
  }
  return -1
}