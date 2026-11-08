import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac-guard'
import { workerSvc } from '@/lib/services/worker'
import { serviceErrorResponse } from '@/lib/internal-client'
import { mapPerformance } from '@/lib/ranking-api'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ workerId: string }> }) {
  const guard = await requirePermission('ranking:view')
  if (!guard.ok) return guard.response
  const { workerId } = await params // UUID checked by middleware
  try {
    return NextResponse.json(mapPerformance(await workerSvc.performance(workerId)))
  } catch (err) {
    return serviceErrorResponse(err, '[GET worker ranking]')
  }
}