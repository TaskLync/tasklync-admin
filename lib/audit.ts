// lib/audit.ts
import type { PoolClient } from 'pg'
import { db } from '@/lib/db'

interface AuditParams {
  adminId: string | null
  adminEmail: string
  action: string
  resourceType?: string
  resourceId?: string
  oldValue?: unknown
  newValue?: unknown
  notes?: string
  ip: string
  userAgent?: string
}

const SQL = `INSERT INTO admin_audit_log
  (admin_id, admin_email, action, resource_type, resource_id, old_value, new_value, notes, ip_address, user_agent)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`

function values(p: AuditParams) {
  return [
    p.adminId,
    p.adminEmail,
    p.action,
    p.resourceType ?? null,
    p.resourceId ?? null,
    p.oldValue ? JSON.stringify(p.oldValue) : null,
    p.newValue ? JSON.stringify(p.newValue) : null,
    p.notes ?? null,
    p.ip,
    p.userAgent?.slice(0, 500) ?? null,
  ]
}

/**
 * Writes an audit entry.
 *  - with `client` (inside withTx): failure throws, so the action rolls back with it.
 *  - without `client` (after the action): never throws; returns false and prints the entry for recovery.
 */
export async function logAdminAction(params: AuditParams, client?: PoolClient): Promise<boolean> {
  if (client) {
    await client.query(SQL, values(params))
    return true
  }
  try {
    await db.query(SQL, values(params))
    return true
  } catch (err) {
    console.error('[audit] FAILED to write audit entry. Recover it from this line:', JSON.stringify(params), err)
    return false
  }
}

/** For login/MFA/session events: an audit-table hiccup must never lock admins out. */
export async function logAuthEvent(params: AuditParams) {
  await logAdminAction(params)
}

// Client IP. x-real-ip first, then the FIRST x-forwarded-for hop. Truncated to fit VARCHAR(50).
// Only trustworthy behind a proxy that overwrites these headers (Vercel, nginx `proxy_set_header X-Real-IP $remote_addr`, Cloudflare).
export function getClientIp(request: Request): string {
  const raw =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    ''
  const ip = raw.trim().slice(0, 45)
  return ip || 'unknown'
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')?.slice(0, 500) ?? null
}