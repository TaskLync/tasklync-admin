import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'

export const dynamic = 'force-dynamic'

/**
 * Destination picker for the banner editor: active categories, or verified + active workers / agencies.
 * Read-only lookup; booking-service re-validates the chosen target on save and publish.
 *   ?type=CATEGORY|WORKER|COMPANY&search=...   or   ?type=...&id=...   (resolve one id to its label)
 */
export async function GET(req: NextRequest) {
  const guard = await requirePermission('banners:manage')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const type = sp.get('type')
  const id = sp.get('id')?.trim() || null
  const search = (sp.get('search') || '').trim().slice(0, 60)
  const like = `%${search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`

  try {
    if (type === 'CATEGORY') {
      const { rows } = await db.query(
        `SELECT id, name, name_ur FROM categories
          WHERE is_active = true AND ($1::text IS NULL OR id = $1) AND ($2 = '%%' OR name ILIKE $2 OR id ILIKE $2)
          ORDER BY sort_order, name LIMIT 20`,
        [id, like],
      )
      return NextResponse.json({ data: rows.map((r) => ({ id: r.id, label: r.name, sub: r.name_ur ?? r.id })) })
    }

    if (type === 'WORKER' || type === 'COMPANY') {
      if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ data: [] })
      const { rows } = await db.query(
        `SELECT w.id, COALESCE(NULLIF(w.business_name, ''), w.name) AS label, w.city, w.phone
           FROM workers w
          WHERE w.deleted_at IS NULL AND w.is_active = true AND w.verification_status = 'VERIFIED'
            AND w.provider_type = $1
            AND ($2::uuid IS NULL OR w.id = $2::uuid)
            AND ($3 = '%%' OR w.name ILIKE $3 OR w.business_name ILIKE $3 OR w.phone ILIKE $3)
          ORDER BY w.total_bookings DESC NULLS LAST, w.name LIMIT 20`,
        [type === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL', id, like],
      )
      return NextResponse.json({
        data: rows.map((r) => ({
          id: r.id, label: r.label,
          sub: [r.city, r.phone ? `••${String(r.phone).slice(-4)}` : null].filter(Boolean).join(' · ') || null,
        })),
      })
    }

    return NextResponse.json({ error: 'Unknown destination type' }, { status: 400 })
  } catch (err) {
    console.error('[GET banner targets]', err)
    return NextResponse.json({ error: 'Failed to load destinations' }, { status: 500 })
  }
}
