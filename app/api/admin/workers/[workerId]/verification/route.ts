// app/api/admin/workers/[workerId]/verification/route.ts
// Everything the review page needs, in one round trip.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { STATUS_SQL, isUuid, workerNotFound } from '@/lib/workers-api'
import { CNIC_DUPLICATES_SQL } from '@/lib/verification-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> }
) {
  const guard = await requirePermission('workers:verify')
  if (!guard.ok) return guard.response

  const { workerId } = await params
  if (!isUuid(workerId)) return workerNotFound()

  try {
    const { rows } = await db.query(
      `SELECT
         w.id, w.name, w.phone, w.email, w.city, w.avatar_url, w.bio,
         w.years_experience, w.created_at, w.last_seen_at, w.warning_count,
         w.date_of_birth::text AS date_of_birth,
         w.registration_ip, w.cnic_number,
         lower(w.verification_status::text) AS verification_status,
         ${STATUS_SQL} AS account_status,
         w.verification_rejection_code, w.verification_rejection_note,
         w.verification_resubmission_allowed,
         w.reverification_reason,
         (SELECT min(d.created_at) FROM worker_documents d
            WHERE d.worker_id = w.id AND d.status = 'PENDING') AS waiting_since,
         (
           w.reverification_requested_at IS NOT NULL
           OR EXISTS (SELECT 1 FROM worker_verification_reviews rr
                      WHERE rr.worker_id = w.id AND rr.decision = 'rejected')
         ) AS is_resubmission
       FROM workers w
       WHERE w.id = $1 AND w.deleted_at IS NULL`,
      [workerId]
    )
    if (rows.length === 0) return workerNotFound()
    const w = rows[0]

    const [docsRes, skillsRes, dupRes, reviewsRes, activityRes] = await Promise.all([
      db.query(
        `SELECT id, type::text AS type, file_url, status::text AS status,
                rejection_note, reviewed_at, created_at
         FROM worker_documents
         WHERE worker_id = $1
         ORDER BY created_at ASC`,
        [workerId]
      ),
      db.query(
        `SELECT s.id, s.category_id, c.name AS category_name, s.years_exp, s.is_verified
         FROM worker_skills s
         LEFT JOIN categories c ON c.id = s.category_id
         WHERE s.worker_id = $1
         ORDER BY c.sort_order, c.name`,
        [workerId]
      ),
      w.cnic_number
        ? db.query(CNIC_DUPLICATES_SQL, [w.cnic_number, workerId])
        : Promise.resolve({ rows: [] as any[] }),
      db.query(
        `SELECT id, decision, reason_code, note, allow_resubmission, admin_email, created_at
         FROM worker_verification_reviews
         WHERE worker_id = $1
         ORDER BY created_at DESC`,
        [workerId]
      ),
      db.query(
        `SELECT id, action, admin_email, notes, created_at
         FROM admin_audit_log
         WHERE resource_type = 'worker'
           AND resource_id = $1
           AND action LIKE 'worker.verification%'
         ORDER BY created_at DESC
         LIMIT 50`,
        [workerId]
      ),
    ])

    return NextResponse.json({
      worker: {
        id: w.id,
        name: w.name,
        phone: w.phone,
        email: w.email,
        city: w.city,
        avatarUrl: w.avatar_url,
        bio: w.bio,
        yearsExperience: w.years_experience ?? 0,
        createdAt: w.created_at,
        lastSeenAt: w.last_seen_at,
        warningCount: w.warning_count ?? 0,
        dateOfBirth: w.date_of_birth,
        registrationIp: w.registration_ip,
        cnicNumber: w.cnic_number,
        verificationStatus: w.verification_status,
        accountStatus: w.account_status,
        isResubmission: w.is_resubmission,
        waitingSince: w.waiting_since,
        rejectionCode: w.verification_rejection_code,
        rejectionNote: w.verification_rejection_note,
        resubmissionAllowed: w.verification_resubmission_allowed,
        reverificationReason: w.reverification_reason,
      },
      documents: docsRes.rows.map((r) => ({
        id: r.id,
        type: r.type,
        fileUrl: r.file_url,
        status: r.status,
        rejectionNote: r.rejection_note,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      })),
      skills: skillsRes.rows.map((r) => ({
        id: r.id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        yearsExp: r.years_exp ?? 0,
        isVerified: r.is_verified,
      })),
      cnicDuplicates: dupRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        verificationStatus: r.verification_status,
      })),
      reviews: reviewsRes.rows.map((r) => ({
        id: r.id,
        decision: r.decision,
        reasonCode: r.reason_code,
        note: r.note,
        allowResubmission: r.allow_resubmission,
        adminEmail: r.admin_email,
        createdAt: r.created_at,
      })),
      activity: activityRes.rows.map((r) => ({
        id: r.id,
        action: r.action,
        adminEmail: r.admin_email,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error('[GET worker verification]', err)
    return NextResponse.json({ error: 'Failed to load verification details' }, { status: 500 })
  }
}