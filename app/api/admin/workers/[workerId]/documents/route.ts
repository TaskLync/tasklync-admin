// app/api/admin/workers/[workerId]/documents/route.ts
// Gated by workers:verify (SUPER_ADMIN, OPS): these are CNIC / passport images.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { isUuid, workerNotFound } from '@/lib/workers-api'

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
      `SELECT id, type::text AS type, file_url, status::text AS status,
              rejection_note, reviewed_at, created_at
       FROM worker_documents
       WHERE worker_id = $1
       ORDER BY created_at DESC`,
      [workerId]
    )
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        fileUrl: r.file_url,
        status: r.status,
        rejectionNote: r.rejection_note,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      }))
    )
  } catch (err: any) {
    if (err?.code === '42P01') return NextResponse.json([])
    console.error('[GET worker documents]', err)
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 })
  }
}