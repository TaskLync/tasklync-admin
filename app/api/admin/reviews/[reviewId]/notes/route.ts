// app/api/admin/reviews/[reviewId]/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { NOTE_MAX_LENGTH } from '@/lib/review-constants'
import { isUuid, reviewErrorResponse, reviewNotFound } from '@/lib/reviews-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const guard = await requirePermission('reviews:view')
  if (!guard.ok) return guard.response

  const { reviewId } = await params
  if (!isUuid(reviewId)) return reviewNotFound()

  try {
    const { rows } = await db.query(
      `SELECT id, admin_email, note, created_at
       FROM review_admin_notes
       WHERE review_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [reviewId]
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
    return reviewErrorResponse(err, '[GET review notes]')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const guard = await requirePermission('reviews:note')
  if (!guard.ok) return guard.response

  const { reviewId } = await params
  if (!isUuid(reviewId)) return reviewNotFound()

  const body = await req.json().catch(() => ({}))
  const note = String(body.note ?? '').trim()
  if (!note) return NextResponse.json({ error: 'A note is required' }, { status: 400 })
  if (note.length > 2000) {
    return NextResponse.json({ error: 'Notes are limited to 2000 characters' }, { status: 400 })
  }

  try {
    const exists = await db.query('SELECT 1 FROM reviews WHERE id = $1', [reviewId])
    if (exists.rows.length === 0) return reviewNotFound()

    const { rows } = await db.query(
      `INSERT INTO review_admin_notes (review_id, admin_id, admin_email, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, admin_email, note, created_at`,
      [reviewId, guard.admin.adminId, guard.admin.adminEmail, note]
    )

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'review.note_added',
      resourceType: 'review',
      resourceId: reviewId,
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
    return reviewErrorResponse(err, '[POST review note]')
  }
}