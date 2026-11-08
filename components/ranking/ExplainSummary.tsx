'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { REASON_TEXT, SEVERITY_TONE, mult, pts } from '@/components/ranking/explain-ui'
import type { RankingExplain } from '@/types/ranking'

export default function ExplainSummary({ e }: { e: RankingExplain }) {
  const name = e.worker.businessName ?? e.worker.name ?? e.worker.id.slice(0, 8)
  const ctx = [e.context.q && `"${e.context.q}"`, e.context.categoryId, e.context.city, e.context.hasLocation && 'with location']
    .filter(Boolean).join(' · ') || 'plain browse (no text, no filters)'

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{name}</h2>
          <p className="text-xs text-gray-500">
            {e.worker.city ?? 'No city'} · {e.worker.avgRating.toFixed(1)} stars ({e.worker.totalReviews} reviews) · {e.worker.totalBookings} bookings
          </p>
          <p className="mt-1 text-xs text-gray-400">Search: {ctx} · ranking version {e.context.rankingVersion}
            {e.context.overridesApplied ? ' + category/city override' : ''}{e.context.fallbackConfig ? ' (fallback defaults)' : ''}</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-gray-400">Final score</p>
            <p className="text-2xl font-semibold text-gray-900">{pts(e.finalScore)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Position</p>
            <p className="text-2xl font-semibold text-gray-900">
              {e.rank?.afterDiversity ? `#${e.rank.afterDiversity}` : 'n/a'}
            </p>
            {e.rank && <p className="text-xs text-gray-400">of {e.rank.totalMatching} matching{e.rank.totalMatching > e.rank.scanned ? ` (top ${e.rank.scanned} checked)` : ''}</p>}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={e.eligibility.visible ? 'success' : 'danger'}>{e.eligibility.visible ? 'Visible in search' : 'Hidden from search'}</Badge>
        <Badge tone={e.eligibility.matchesFilters ? 'success' : 'warning'}>{e.eligibility.matchesFilters ? 'Matches this search' : 'Does not match this search'}</Badge>
        {e.rank?.moved && e.rank.scoreOrder && e.rank.afterDiversity && (
          <Badge tone="info">Score order #{e.rank.scoreOrder}, shown #{e.rank.afterDiversity}</Badge>
        )}
      </div>

      <p className="mt-4 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
        <b>How the score is built:</b> weighted terms {pts(e.weighted.points)} {mult(e.multipliers.product)} (penalties) = {pts(e.afterFloors)}
        {' '}+ boost {pts(e.boost.applied)} = <b>{pts(e.finalScore)}</b>.
      </p>

      {e.reasonCodes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {e.reasonCodes.map((r, i) => {
            const t = REASON_TEXT[r.code]
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge tone={SEVERITY_TONE[r.severity] ?? 'neutral'} className="shrink-0">{t?.label ?? r.code}</Badge>
                <span className="text-gray-600">{t?.text ?? ''}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}