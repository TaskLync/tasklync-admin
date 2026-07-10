// app/api/admin/waitlist/export/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'

function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const guard = await requirePermission('waitlist:view')
  if (!guard.ok) return guard.response

  try {
    const { rows } = await db.query(
      `SELECT position, email, status, utm_source, utm_medium, utm_campaign, utm_content,
              ip_address, created_at
       FROM waitlist
       ORDER BY position ASC`
    )

    const header =
      'Position,Email,Status,UTM Source,UTM Medium,UTM Campaign,UTM Content,IP Address,Joined At\n'

    const csv = rows
      .map((r) =>
        [
          r.position,
          r.email,
          r.status,
          r.utm_source,
          r.utm_medium,
          r.utm_campaign,
          r.utm_content,
          r.ip_address,
          new Date(r.created_at).toISOString(),
        ]
          .map(csvEscape)
          .join(',')
      )
      .join('\n')

    await logAdminAction({
      adminId: guard.admin.adminId,
      adminEmail: guard.admin.adminEmail,
      action: 'waitlist.exported',
      resourceType: 'waitlist',
      notes: `Exported ${rows.length} rows`,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return new NextResponse(header + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="waitlist-export-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('[waitlist/export]', error)
    return NextResponse.json({ error: 'Failed to export waitlist' }, { status: 500 })
  }
}