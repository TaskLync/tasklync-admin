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
      params.userAgent ?? null,
    ]
  )
}

// Extracts client IP from standard proxy headers.
// Works on Vercel and any reverse proxy (nginx, Cloudflare) forwarding x-forwarded-for.
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}