import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { logAdminAction, getClientIp } from '@/lib/audit'
import { bannerSvc } from '@/lib/services/booking'
import { serviceErrorResponse } from '@/lib/internal-client'
import { IMAGE_RULES } from '@/lib/banner-constants'

export const dynamic = 'force-dynamic'

/**
 * Multipart field "image". Quick checks here (type, size) so obvious mistakes fail fast;
 * booking-service re-checks the real type from the file bytes, the dimensions and the ratio.
 */
export async function POST(req: NextRequest) {
  const guard = await requirePermission('banners:manage')
  if (!guard.ok) return guard.response

  const form = await req.formData().catch(() => null)
  const file = form?.get('image')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Choose an image file' }, { status: 400 })
  }
  if (!(IMAGE_RULES.types as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image' }, { status: 400 })
  }
  if (file.size > IMAGE_RULES.maxMb * 1024 * 1024) {
    return NextResponse.json({ error: `The image is larger than ${IMAGE_RULES.maxMb} MB` }, { status: 413 })
  }

  const admin = { id: guard.admin.adminId, email: guard.admin.adminEmail }
  try {
    const out = await bannerSvc.uploadImage(admin, file, file.name.slice(0, 100) || 'banner')
    await logAdminAction({
      adminId: admin.id, adminEmail: admin.email, action: 'banner.image_uploaded', resourceType: 'banner_image',
      resourceId: out.public_id, newValue: { width: out.width, height: out.height, bytes: out.bytes },
      ip: getClientIp(req), userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({
      data: { url: out.url, publicId: out.public_id, width: out.width, height: out.height },
    }, { status: 201 })
  } catch (err) {
    return serviceErrorResponse(err, '[POST banner media]')
  }
}
