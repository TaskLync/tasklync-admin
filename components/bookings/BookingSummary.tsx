// components/bookings/BookingSummary.tsx
'use client'

import { Card } from '@/components/ui/Card'
import { formatDateTime, formatDuration, formatPkr } from './booking-ui'
import type { BookingDetail } from '@/types/booking'

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

function mapEmbedUrl(lat: number, lng: number) {
  const dLng = 0.005
  const dLat = 0.003
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`
}

export default function BookingSummary({ booking }: { booking: BookingDetail }) {
  const p = booking.pricing
  const cur = p.currency
  const isHourly = p.priceType === 'hourly'
  const baseTotal = isHourly ? p.basePrice * booking.durationHours : p.basePrice
  const feePct = p.estimatedTotal > 0 ? (p.platformFee / p.estimatedTotal) * 100 : 0
  const refund = p.refundAmount ?? 0
  const finalAmount = p.estimatedTotal - refund

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Summary</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <SectionTitle>Service</SectionTitle>
            <Row label="Category">{booking.categoryName ?? booking.categoryId}</Row>
            <Row label="Service">{booking.serviceName ?? '—'}</Row>
            <Row label="Scheduled">{formatDateTime(booking.scheduledAt)}</Row>
            <Row label="Duration">{formatDuration(booking.durationHours)}</Row>
            <Row label="Started">{formatDateTime(booking.startedAt)}</Row>
            <Row label="Completed">{formatDateTime(booking.completedAt)}</Row>
            <Row label="Worker must respond by">{formatDateTime(booking.expiresAt)}</Row>
          </div>

          {(booking.description || booking.workerNote) && (
            <div>
              <SectionTitle>Notes</SectionTitle>
              {booking.description && (
                <p className="text-sm text-gray-700">
                  <span className="text-gray-400">Customer: </span>
                  {booking.description}
                </p>
              )}
              {booking.workerNote && (
                <p className="mt-1 text-sm text-gray-700">
                  <span className="text-gray-400">Worker: </span>
                  {booking.workerNote}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <SectionTitle>Pricing (snapshot at booking time)</SectionTitle>
          <Row label={isHourly ? `Base ${formatPkr(p.basePrice, cur)}/hr × ${booking.durationHours} h` : 'Base price (fixed)'}>
            {formatPkr(baseTotal, cur)}
          </Row>
          <Row label="Urgency multiplier">× {p.urgencyMultiplier}</Row>
          <Row label="Demand multiplier">× {p.demandMultiplier}</Row>
          <Row label="Time-of-day multiplier">× {p.timeOfDayMultiplier}</Row>
          <div className="my-1 border-t border-gray-100" />
          <Row label="Quoted total">
            <span className="font-semibold">{formatPkr(p.estimatedTotal, cur)}</span>
          </Row>
          <Row label={`Platform fee (${feePct.toFixed(0)}%)`}>{formatPkr(p.platformFee, cur)}</Row>
          <Row label="Worker payout">{formatPkr(p.workerAmount, cur)}</Row>
          {refund > 0 && (
            <Row label={`Refund${p.refundPercentage !== null ? ` (${p.refundPercentage}%)` : ''}`}>
              <span className="text-[#DC2626]">− {formatPkr(refund, cur)}</span>
            </Row>
          )}
          <div className="my-1 border-t border-gray-100" />
          <Row label="Final amount">
            <span className="font-semibold">{formatPkr(finalAmount, cur)}</span>
          </Row>
        </div>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4">
        <SectionTitle>Job site</SectionTitle>
        <p className="text-sm text-gray-800">{booking.addressText}</p>

        {booking.lat !== null && booking.lng !== null ? (
          <div className="mt-2">
            <iframe
              title="Job site map"
              src={mapEmbedUrl(booking.lat, booking.lng)}
              className="h-48 w-full rounded-md border border-gray-200"
              loading="lazy"
            />
            <a
              href={`https://www.google.com/maps?q=${booking.lat},${booking.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-[#1F6F5F] hover:underline"
            >
              Open in Google Maps ({booking.lat.toFixed(5)}, {booking.lng.toFixed(5)})
            </a>
          </div>
        ) : (
          <p className="mt-1 text-xs text-gray-400">No coordinates stored for this booking.</p>
        )}
      </div>
    </Card>
  )
}