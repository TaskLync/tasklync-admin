// app/api/admin/bookings/[bookingId]/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
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
      `SELECT m.id, m.sender_id, m.sender_type::text AS sender_type, m.type::text AS type,
              m.content, m.media_url, m.media_thumbnail_url, m.metadata, m.created_at
       FROM messages m
       WHERE m.booking_id = $1
       ORDER BY m.created_at ASC
       LIMIT 1000`,
      [bookingId]
    )
    return NextResponse.json({
      available: true,
      data: rows.map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        senderType: r.sender_type,
        type: r.type,
        content: r.content,
        mediaUrl: r.media_url,
        mediaThumbnailUrl: r.media_thumbnail_url,
        metadata: r.metadata,
        createdAt: r.created_at,
      })),
    })
  } catch (err: any) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return NextResponse.json({ available: false, data: [] })
    }
    console.error('[GET booking chat]', err)
    return NextResponse.json({ error: 'Failed to load the chat transcript' }, { status: 500 })
  }
}