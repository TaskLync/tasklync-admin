// components/disputes/DisputeSummary.tsx  (spec 7.2a)
'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { isActiveDispute, stripAdminPrefix } from '@/lib/dispute-constants'
import type { DisputeDetail } from '@/types/dispute'
import { formatAge, formatDateTime, formatPkr, shortId } from './dispute-ui'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{children}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h3>
  )
}

/** "Booking ended 3h 20m before the dispute was opened". */
function gap(from: string | null, to: string): string {
  if (!from) return '—'
  const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000)
  if (mins < 0) return '—'
  if (mins < 60) return `${mins} min after`
  const h = Math.floor(mins / 60)
  return h < 48 ? `${h}h ${mins % 60}m after` : `${Math.floor(h / 24)} days after`
}

export default function DisputeSummary({ dispute }: { dispute: DisputeDetail }) {
  const b = dispute.booking
  const cur = b.currency
  const active = isActiveDispute(dispute.status)

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Summary</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <SectionTitle>Timeline</SectionTitle>
          <Row label="Booking">
            <Link
              href={`/bookings/${b.id}`}
              className="font-mono text-xs hover:text-[#1F6F5F] hover:underline"
            >
              {shortId(b.id)}
            </Link>
          </Row>
          <Row label="Scheduled">{formatDateTime(b.scheduledAt)}</Row>
          <Row label="Job started">{formatDateTime(b.startedAt)}</Row>
          <Row label="Worker marked done">{formatDateTime(b.completedAt)}</Row>
          <Row label="Dispute opened">{formatDateTime(dispute.createdAt)}</Row>
          <Row label="Opened">{gap(b.completedAt, dispute.createdAt)} completion</Row>
          <Row label={active ? 'Open for' : 'Resolved'}>
            {active ? formatAge(dispute.createdAt) : formatDateTime(dispute.resolvedAt)}
          </Row>
        </div>

        <div>
          <SectionTitle>Money</SectionTitle>
          <Row label="Amount disputed">
            <span className="font-semibold">{formatPkr(b.estimatedTotal, cur)}</span>
          </Row>
          <Row label="Platform fee">{formatPkr(b.platformFee, cur)}</Row>
          <Row label="Worker payout">{formatPkr(b.workerAmount, cur)}</Row>
          <Row label="Payment confirmed">{b.isPaymentConfirmed ? 'Yes' : 'No (COD or unpaid)'}</Row>
          <Row label="Booking status">{b.status.replace(/_/g, ' ').toLowerCase()}</Row>
          {dispute.refundAmount !== null && dispute.refundAmount > 0 && (
            <Row label="Refund decided">{formatPkr(dispute.refundAmount, cur)}</Row>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4">
        <SectionTitle>Why it was raised</SectionTitle>
        <p className="whitespace-pre-wrap break-words text-sm text-gray-800">
          {stripAdminPrefix(dispute.reason)}
        </p>
      </div>

      {dispute.adminNote && (
        <div className="mt-4 rounded-md bg-gray-50 px-3 py-2">
          <SectionTitle>Resolution note</SectionTitle>
          <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{dispute.adminNote}</p>
          <p className="mt-1 text-[11px] text-gray-400">
            {dispute.resolvedByName ?? 'Admin'} · {formatDateTime(dispute.resolvedAt)}
          </p>
        </div>
      )}
    </Card>
  )
}