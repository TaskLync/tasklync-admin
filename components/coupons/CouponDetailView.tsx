'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { couponActions, useCouponDetail, useCouponRedemptions } from '@/hooks/useCoupons'
import { STATE_LABEL } from '@/lib/coupon-constants'
import { formatDateTime, formatPkr, shortId } from '@/components/bookings/booking-ui'
import { STATE_TONE, offerText } from './CouponsSection'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{children}</span>
    </div>
  )
}

type Pending = 'pause' | 'end' | 'reject' | null

export default function CouponDetailView({ couponId }: { couponId: string }) {
  const { coupon: c, isLoading, error, mutate } = useCouponDetail(couponId)
  const { rows } = useCouponRedemptions(couponId)
  const canManage = usePermission('coupons:manage')
  const canApprove = usePermission('coupons:approve-high')
  const [pending, setPending] = useState<Pending>(null)
  const [extendOpen, setExtendOpen] = useState(false)
  const [newEnd, setNewEnd] = useState('')

  async function run(action: string, body: { reason?: string; endsAt?: string } = {}, ok = 'Done') {
    await couponActions.act(couponId, action, body)
    toast.success(ok)
    await mutate()
  }

  if (isLoading) return <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
  if (error || !c) return <p className="text-sm text-gray-500">Couldn't load this coupon.</p>

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-base font-semibold text-gray-900">{c.code}</h2>
            <Badge tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Badge>
          </div>
          <Row label="Title">{c.title}</Row>
          <Row label="Offer">{offerText(c)}</Row>
          <Row label="Minimum job amount">{formatPkr(c.minBookingAmount, 'PKR')}</Row>
          <Row label="Categories">{c.scopeCategoryIds.length ? c.scopeCategoryIds.join(', ') : 'All'}</Row>
          <Row label="First booking only">{c.firstBookingOnly ? 'Yes' : 'No'}</Row>
          <Row label="Uses per customer">{c.perUserLimit}</Row>
          <Row label="Valid">{formatDateTime(c.startsAt)} to {formatDateTime(c.endsAt)}</Row>
          <Row label="Used">{c.redemptionCount}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</Row>
          <Row label="Discounted so far">{formatPkr(c.budgetSpentPkr, 'PKR')}{c.budgetCapPkr ? ` of ${formatPkr(c.budgetCapPkr, 'PKR')}` : ''}</Row>
          <Row label="Created by">{c.createdByEmail}</Row>
          {c.rejectionReason && <Row label="Rejection reason">{c.rejectionReason}</Row>}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Redemptions ({c.stats.consumed} used, {c.stats.released} given back, {formatPkr(c.stats.discountPkr, 'PKR')})
          </h2>
          {rows.length === 0 ? <p className="text-sm text-gray-400">None yet.</p> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-1.5">
                  <span>{r.userName ?? 'Customer'} <span className="font-mono text-xs text-gray-400">…{r.phoneLast4}</span> · <a className="text-[#1F6F5F] hover:underline" href={`/bookings/${r.bookingId}`}>{shortId(r.bookingId)}</a></span>
                  <span className="text-gray-600">{formatPkr(r.discountAmount, 'PKR')} · {r.status === 'RELEASED' ? `given back (${r.releaseReason ?? ''})` : 'used'}</span>
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
            {canApprove && c.status === 'PENDING_APPROVAL' && (
              <>
                <Button onClick={() => run('approve', {}, 'Approved').catch((e) => toast.error(e.message))}>Approve</Button>
                <Button variant="destructive" onClick={() => setPending('reject')}>Reject</Button>
              </>
            )}
            {canManage && c.status === 'ACTIVE' && <Button variant="secondary" onClick={() => setPending('pause')}>Pause</Button>}
            {canManage && c.status === 'PAUSED' && <Button onClick={() => run('resume', {}, 'Resumed').catch((e) => toast.error(e.message))}>Resume</Button>}
            {canManage && ['ACTIVE', 'PAUSED'].includes(c.status) && <Button variant="secondary" onClick={() => setExtendOpen(true)}>Extend</Button>}
            {canManage && ['ACTIVE', 'PAUSED', 'PENDING_APPROVAL'].includes(c.status) && <Button variant="destructive" onClick={() => setPending('end')}>End now</Button>}
          </div>
          {c.status === 'PENDING_APPROVAL' && <p className="mt-3 text-xs text-amber-700">Needs a second approver. The creator cannot approve their own coupon.</p>}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">History</h2>
          <ul className="flex flex-col gap-2 text-xs text-gray-600">
            {c.history.map((h, i) => (
              <li key={i}>{formatDateTime(h.createdAt)} · {h.fromStatus ? `${h.fromStatus} → ` : ''}<b>{h.toStatus}</b> · {h.actorEmail ?? 'system'}{h.note ? ` · ${h.note}` : ''}</li>
            ))}
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={pending !== null} requireReason destructive={pending !== 'pause'}
        title={pending === 'pause' ? 'Pause this coupon?' : pending === 'reject' ? 'Reject this coupon?' : 'End this coupon now?'}
        description={pending === 'end' ? 'Customers can no longer use it. Bookings that already used it keep their discount.' : undefined}
        confirmLabel={pending === 'pause' ? 'Pause' : pending === 'reject' ? 'Reject' : 'End coupon'}
        onClose={() => setPending(null)}
        onConfirm={async (reason) => { if (pending) await run(pending, { reason }, 'Done') }}
      />

      {extendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Extend coupon</h2>
            <div className="mt-3"><Input label="New end" type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} /></div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setExtendOpen(false)}>Cancel</Button>
              <Button disabled={!newEnd} onClick={() => run('extend', { endsAt: new Date(newEnd).toISOString() }, 'Extended').then(() => setExtendOpen(false)).catch((e) => toast.error(e.message))}>Extend</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}