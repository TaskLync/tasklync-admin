import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { hashPassword, verifyPassword } from './password'
import crypto from 'crypto'

export function generateMfaSecret() {
  return authenticator.generateSecret()
}

export async function generateMfaQrCode(email: string, secret: string): Promise<string> {
  const otpauth = authenticator.keyuri(email, 'Tasklync Admin', secret)
  return QRCode.toDataURL(otpauth) // returns a data: URL, render directly in an <img>
}

export function verifyTotp(code: string, secret: string): boolean {
  return authenticator.check(code, secret)
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-')
  )
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => hashPassword(c)))
}

export async function verifyBackupCode(code: string, hashes: string[]): Promise<number> {
  // returns the index of the matching hash, or -1
  for (let i = 0; i < hashes.length; i++) {
    if (await verifyPassword(code, hashes[i])) return i
  }
  return -1
}