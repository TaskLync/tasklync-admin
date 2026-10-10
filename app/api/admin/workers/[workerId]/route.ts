// app/api/admin/workers/[workerId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid, workerNotFound } from '@/lib/workers-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:view')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  try {
    const { rows } = await db.query(`SELECT * FROM get_worker_overview($1)`, [workerId])
    if (rows.length === 0) return workerNotFound()

    const r = rows[0]
    return NextResponse.json({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      city: r.city,
      country: r.country,
      preferredLanguage: r.preferred_language,
      currency: r.currency,
      yearsExperience: r.years_experience ?? 0,
      avgRating: Number(r.avg_rating ?? 0),
      totalReviews: r.total_reviews ?? 0,
      totalBookings: r.total_bookings ?? 0,
      responseTimeMins: r.response_time_mins ?? 0,
      isActive: r.is_active,
      isFeatured: r.is_featured,
      featuredAt: r.featured_at,
      manuallyPaused: r.manually_paused,
      isOnJob: r.is_on_job,
      lastSeenAt: r.last_seen_at,
      verificationStatus: r.verification_status,
      status: r.status,
      presence: r.presence,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      suspendedUntil: r.suspended_until,
      suspendedReason: r.suspended_reason,
      bannedAt: r.banned_at,
      bannedReason: r.banned_reason,
      warningCount: r.warning_count,
      lastWarningAt: r.last_warning_at,
      lastWarningReason: r.last_warning_reason,
      reverificationRequestedAt: r.reverification_requested_at,
      reverificationReason: r.reverification_reason,
      skillCount: Number(r.skill_count),
      offeringCount: Number(r.offering_count),
      documentCount: Number(r.document_count),
      pendingDocumentCount: Number(r.pending_document_count),
      skills: r.skills ?? [],
      badges: r.badges ?? [],
    })
  } catch (err) {
    console.error('[GET /api/admin/workers/[workerId]]', err)
    return NextResponse.json({ error: 'Failed to load worker' }, { status: 500 })
  }
}