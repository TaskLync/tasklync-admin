// lib/auth/crypto.ts  (server only)
import crypto from 'crypto'

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function encryptionKey(): Buffer {
  const raw = process.env.ADMIN_MFA_ENCRYPTION_KEY
  if (!raw) throw new Error('ADMIN_MFA_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('ADMIN_MFA_ENCRYPTION_KEY must be 32 bytes (base64)')
  return key
}

const PREFIX = 'v1:'

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX)
}

/** AES-256-GCM. Output: v1:<iv>.<tag>.<ciphertext> (all base64) */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv, tag, enc].map((b) => b.toString('base64')).join('.')
}

/** Legacy plaintext secrets (no v1: prefix) pass through so existing admins keep working. */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored
  const [ivB64, tagB64, encB64] = stored.slice(PREFIX.length).split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8')
}

/** Backup codes carry 40 bits of entropy: HMAC with a server-side pepper is enough and ~1000x faster than bcrypt. */
export function hmacBackupCode(code: string): string {
  const key = crypto.createHash('sha256').update('backup-codes:').update(encryptionKey()).digest()
  return 'hmac1:' + crypto.createHmac('sha256', key).update(code).digest('hex')
}