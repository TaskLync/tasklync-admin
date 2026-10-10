// app/api/admin/disputes/[disputeId]/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { NOTE_MAX_LENGTH } from '@/lib/dispute-constants'
import { disputeErrorResponse, disputeNotFound } from '@/lib/disputes-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const guard = await requirePermission('disputes:view')
  if (!guard.ok) return guard.response

  const { disputeId } = await params
  if (!isUuid(disputeId)) return disputeNotFound()

  try {
    const { rows } = await db.query(
      `SELECT id, admin_email, note, created_at
       FROM dispute_admin_notes
       WHERE dispute_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [disputeId]
    )
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        adminEmail: r.admin_email,
        note: r.note,
        createdAt: r.created_at,
      }))
    )
  } catch (err) {
    return disputeErrorResponse(err, '[GET dispute notes]')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const guard = await requirePermission('disputes:note')
  if (!guard.ok) return guard.response

  const { disputeId } = await params
  if (!isUuid(disputeId)) return disputeNotFound()

  const body = await req.json().catch(() => ({}))
  const note = String(body.note ?? '').trim()
  if (!note) return NextResponse.json({ error: 'A note is required' }, { status: 400 })
  if (note.length > 2000) {
    return NextResponse.json({ error: 'Notes are limited to 2000 characters' }, { status: 400 })
  }

  try {
    const exists = await db.query('SELECT 1 FROM disputes WHERE id = $1', [disputeId])
    if (exists.rows.length === 0) return disputeNotFound()

    const { rows } = await db.query(
      `INSERT INTO dispute_admin_notes (dispute_id, admin_id, admin_email, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, admin_email, note, created_at`,
      [disputeId, guard.admin.adminId, guard.admin.adminEmail, note]
    )

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'dispute.note_added',
      resourceType: 'dispute',
      resourceId: disputeId,
      notes: note.slice(0, NOTE_MAX_LENGTH),
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    const r = rows[0]
    return NextResponse.json(
      { id: r.id, adminEmail: r.admin_email, note: r.note, createdAt: r.created_at },
      { status: 201 }
    )
  } catch (err) {
    return disputeErrorResponse(err, '[POST dispute note]')
  }
}