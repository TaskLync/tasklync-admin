// lib/audit.ts
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

export async function logAdminAction(params: AuditParams) {
  await db.query(
    `INSERT INTO admin_audit_log
      (admin_id, admin_email, action, resource_type, resource_id, old_value, new_value, notes, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      params.adminId,
      params.adminEmail,
      params.action,
      params.resourceType ?? null,
      params.resourceId ?? null,
      params.oldValue ? JSON.stringify(params.oldValue) : null,
      params.newValue ? JSON.stringify(params.newValue) : null,
      params.notes ?? null,
      params.ip,
      params.userAgent?.slice(0, 500) ?? null,
    ]
  )
}

/** For login/MFA/session events: an audit-table hiccup must never lock admins out. */
export async function logAuthEvent(params: AuditParams) {
  try {
    await logAdminAction(params)
  } catch (err) {
    console.error('[audit] failed to write auth event', params.action, err)
  }
}

// Client IP. x-real-ip first, then the FIRST x-forwarded-for hop. Truncated to fit VARCHAR(50).
// This is only trustworthy behind a proxy that overwrites these headers (Vercel, nginx with
// `proxy_set_header X-Real-IP $remote_addr`, Cloudflare). Per-account lockout does not depend on it.
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