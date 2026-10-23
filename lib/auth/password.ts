// lib/auth/password.ts
import bcrypt from 'bcryptjs'

const ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/** bcrypt ignores everything past 72 bytes, so cap there. Returns an error message or null. */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 12) return 'Password must be at least 12 characters.'
  if (Buffer.byteLength(pw) > 72) return 'Password must be at most 72 bytes.'
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) {
    return 'Password needs an uppercase letter, a lowercase letter and a number.'
  }
  return null
}