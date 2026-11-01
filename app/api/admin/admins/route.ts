// app/api/admin/admins/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'

const ROLES = ['SUPER_ADMIN', 'OPS', 'FINANCE', 'SUPPORT']
const MAX_SUPER_ADMINS = 2
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const guard = await requirePermission('admin_users:manage')
  if (!guard.ok) return guard.response

  const { rows } = await db.query(
    `SELECT id, email, full_name, role, is_active, mfa_enabled, last_login_at, locked_until, created_at
       FROM admin_users ORDER BY created_at`
  )
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      role: r.role,
      isActive: r.is_active,
      mfaEnabled: r.mfa_enabled,
      lastLoginAt: r.last_login_at,
      lockedUntil: r.locked_until,
      createdAt: r.created_at,
    }))
  )
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('admin_users:manage')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.fullName ?? '').trim()
  const role = String(body.role ?? '')
  const password = String(body.password ?? '')

  if (!EMAIL_RE.test(email) || email.length > 255) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  if (fullName.length < 2 || fullName.length > 255) return NextResponse.json({ error: 'Enter the full name' }, { status: 400 })
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  const weak = validatePasswordStrength(password)
  if (weak) return NextResponse.json({ error: weak }, { status: 400 })

  if (role === 'SUPER_ADMIN') {
    const c = await db.query(`SELECT count(*)::int AS n FROM admin_users WHERE role = 'SUPER_ADMIN' AND is_active`)
    if (c.rows[0].n >= MAX_SUPER_ADMINS) {
      return NextResponse.json({ error: `At most ${MAX_SUPER_ADMINS} Super Admins are allowed` }, { status: 409 })
    }
  }

  try {
    const hash = await hashPassword(password)
    const { rows } = await db.query(
      `INSERT INTO admin_users (email, password_hash, full_name, role, is_active, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5) RETURNING id`,
      [email, hash, fullName, role, guard.admin.adminId]
    )
    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'admin.created',
      resourceType: 'admin_user',
      resourceId: rows[0].id,
      newValue: { email, role },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 })
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'An admin with that email already exists' }, { status: 409 })
    }
    console.error('[POST admins]', err)
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 })
  }
}