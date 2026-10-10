// app/api/admin/bookings/[bookingId]/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { isUuid } from '@/lib/workers-api'
import { bookingNotFound } from '@/lib/bookings-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:view')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  try {
    const { rows } = await db.query(
      `SELECT id, admin_email, note, created_at
       FROM booking_admin_notes
       WHERE booking_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [bookingId]
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
    console.error('[GET booking notes]', err)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const guard = await requirePermission('bookings:note')
  if (!guard.ok) return guard.response

  const { bookingId } = await params
  if (!isUuid(bookingId)) return bookingNotFound()

  const body = await req.json().catch(() => ({}))
  const note: string = String(body.note ?? '').trim()
  if (!note) return NextResponse.json({ error: 'A note is required' }, { status: 400 })
  if (note.length > 2000) {
    return NextResponse.json({ error: 'Notes are limited to 2000 characters' }, { status: 400 })
  }

  try {
    const exists = await db.query('SELECT 1 FROM bookings WHERE id = $1', [bookingId])
    if (exists.rows.length === 0) return bookingNotFound()

    const { rows } = await db.query(
      `INSERT INTO booking_admin_notes (booking_id, admin_id, admin_email, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, admin_email, note, created_at`,
      [bookingId, guard.admin.adminId, guard.admin.adminEmail, note]
    )

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'booking.note_added',
      resourceType: 'booking',
      resourceId: bookingId,
      notes: note,
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    const r = rows[0]
    return NextResponse.json(
      { id: r.id, adminEmail: r.admin_email, note: r.note, createdAt: r.created_at },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST booking note]', err)
    return NextResponse.json({ error: 'Failed to save the note' }, { status: 500 })
  }
}