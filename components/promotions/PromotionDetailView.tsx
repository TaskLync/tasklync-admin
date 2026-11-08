'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { promotionActions, usePromotionDetail } from '@/hooks/usePromotions'
import { PROMOTION_STATE_LABEL } from '@/lib/promotion-constants'
import { formatDateTime, formatPkr, shortId } from '@/components/bookings/booking-ui'
import { PROMOTION_TONE, discountText } from './PromotionsSection'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{children}</span>
    </div>
  )
}

type Pending = 'reject' | 'pause' | 'end' | null

export default function PromotionDetailView({ promotionId }: { promotionId: string }) {
  const { promotion: p, isLoading, error, mutate } = usePromotionDetail(promotionId)
  const canApprove = usePermission('promotions:approve')
  const canSuspend = usePermission('promotions:suspend')
  const [pending, setPending] = useState<Pending>(null)

  async function run(action: string, body: { reason?: string } = {}, ok = 'Done') {
    await promotionActions.act(promotionId, action, body)
    toast.success(ok)
    await mutate()
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
  if (error || !p) return <p className="text-sm text-gray-500">Couldn't load this offer.</p>

  const status = p.status
  const adminPaused = status === 'PAUSED' && p.pausedBy === 'ADMIN'
  const workerPaused = status === 'PAUSED' && p.pausedBy !== 'ADMIN'

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">{p.title}</h2>
            <Badge tone={PROMOTION_TONE[p.state]}>{PROMOTION_STATE_LABEL[p.state]}</Badge>
          </div>
          {p.description && <p className="mb-2 text-sm text-gray-600">{p.description}</p>}
          <Row label="Worker">
            <Link href={`/workers/${p.workerId}`} className="text-[#1F6F5F] hover:underline">{p.workerName ?? shortId(p.workerId)}</Link>
          </Row>
          <Row label="Discount">{discountText(p)}</Row>
          <Row label="Funded by">Worker (comes off the job subtotal before fees)</Row>
          <Row label="Reference price (snapshot)">{formatPkr(p.referencePrice, 'PKR')}</Row>
          <Row label="Minimum job amount">{formatPkr(p.minBookingAmount, 'PKR')}</Row>
          <Row label="Scope">{p.offeringId ? 'One service' : p.categoryId ? `Category ${p.categoryId}` : 'All services of the worker'}</Row>
          <Row label="Share code">{p.code ?? 'None (applies automatically)'}</Row>
          <Row label="First booking only">{p.firstBookingOnly ? 'Yes' : 'No'}</Row>
          <Row label="Uses per customer">{p.perUserLimit}</Row>
          <Row label="Valid">{formatDateTime(p.startsAt)} to {formatDateTime(p.endsAt)}</Row>
          <Row label="Used">{p.redemptionCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}</Row>
          <Row label="Approval">{p.approvalMode === 'AUTO' ? 'Automatic (inside guardrails)' : 'Needs admin'}</Row>
          {p.rejectionReason && <Row label="Rejection reason">{p.rejectionReason}</Row>}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Impact</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Used', String(p.stats.consumed)],
              ['Given back', String(p.stats.released)],
              ['Customers saved', formatPkr(p.stats.discountPkr, 'PKR')],
              ['Worker cost', formatPkr(p.stats.workerCostPkr, 'PKR')],
            ].map(([l, v]) => (
              <div key={l} className="rounded-md border border-gray-100 p-3">
                <p className="text-xs text-gray-400">{l}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{v}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Abuse signals</h2>
          {p.abuseSignals.length === 0 ? (
            <p className="text-sm text-gray-400">None.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {p.abuseSignals.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-1.5">
                  <span>
                    <b>{a.signal.replaceAll('_', ' ').toLowerCase()}</b>
                    {a.detail ? <span className="ml-2 font-mono text-xs text-gray-400">{JSON.stringify(a.detail)}</span> : null}
                  </span>
                  <span className="text-xs text-gray-500">sev {a.severity} · {formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {canApprove && status === 'PENDING_APPROVAL' && (
              <>
                <Button onClick={() => run('approve', {}, 'Approved').catch((e) => toast.error(e.message))}>Approve</Button>
                <Button variant="destructive" onClick={() => setPending('reject')}>Reject</Button>
              </>
            )}
            {canSuspend && status === 'ACTIVE' && <Button variant="secondary" onClick={() => setPending('pause')}>Pause</Button>}
            {canSuspend && adminPaused && (
              <Button onClick={() => run('resume', {}, 'Resumed').catch((e) => toast.error(e.message))}>Resume</Button>
            )}
            {canSuspend && ['ACTIVE', 'PAUSED', 'PENDING_APPROVAL'].includes(status) && (
              <Button variant="destructive" onClick={() => setPending('end')}>End now</Button>
            )}
          </div>
          {workerPaused && <p className="mt-3 text-xs text-gray-500">Paused by the worker. Only the worker can resume it.</p>}
          {status === 'PENDING_APPROVAL' && (
            <p className="mt-3 text-xs text-amber-700">Over a guardrail or created by a flagged worker, so it needs a decision. The worker is notified.</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">History</h2>
          <ul className="flex flex-col gap-2 text-xs text-gray-600">
            {p.history.map((h, i) => (
              <li key={i}>
                {formatDateTime(h.createdAt)} · {h.fromStatus ? `${h.fromStatus} → ` : ''}<b>{h.toStatus}</b> · {h.actorEmail ?? h.actorType.toLowerCase()}
                {h.note ? ` · ${h.note}` : ''}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={pending !== null} requireReason destructive={pending !== 'pause'}
        title={pending === 'pause' ? 'Pause this offer?' : pending === 'reject' ? 'Reject this offer?' : 'End this offer now?'}
        description={
          pending === 'end'
            ? 'Customers can no longer use it. Bookings that already used it keep their discount.'
            : pending === 'reject'
              ? 'The worker sees this reason in the app.'
              : 'The worker is told it was paused by support and cannot resume it themselves.'
        }
        confirmLabel={pending === 'pause' ? 'Pause' : pending === 'reject' ? 'Reject' : 'End offer'}
        onClose={() => setPending(null)}
        onConfirm={async (reason) => { if (pending) await run(pending, { reason }, 'Done') }}
      />
    </div>
  )
}