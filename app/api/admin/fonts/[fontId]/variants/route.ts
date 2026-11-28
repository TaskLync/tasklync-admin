import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { fontSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { zodResponse } from '@/lib/coupons-api'
import { FONT_RULES, fontVariantSchema, mapFontDetail } from '@/lib/fonts-api'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ fontId: string }> }

/**
 * Multipart: "file" (.ttf / .otf) + "weight" + "style". Quick checks here so obvious mistakes fail fast;
 * booking-service re-checks the real format from the bytes and refuses WOFF / WOFF2 (the app cannot load them).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await requirePermission('fonts:manage')
  if (!guard.ok) return guard.response
  const { fontId } = await params

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose a font file' }, { status: 400 })
  }
  const lower = file.name.toLowerCase()
  if (!FONT_RULES.extensions.some((e) => lower.endsWith(e))) {
    return NextResponse.json({ error: 'Upload a .ttf or .otf font file' }, { status: 400 })
  }
  if (file.size > FONT_RULES.maxMb * 1024 * 1024) {
    return NextResponse.json({ error: `The font file is larger than ${FONT_RULES.maxMb} MB` }, { status: 413 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const v = fontVariantSchema.parse({ weight: form!.get('weight'), style: form!.get('style') ?? undefined })
    const font = mapFontDetail(await fontSvc.uploadVariant(fontId, admin, file, file.name.slice(0, 100), v.weight, v.style))
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'font.file_uploaded', resourceType: 'font',
      resourceId: fontId, newValue: { name: font.name, weight: v.weight, style: v.style, bytes: file.size },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: font }, { status: 201 })
  } catch (err) {
    return zodResponse(err) ?? serviceErrorResponse(err, '[POST font variant]')
  }
}
