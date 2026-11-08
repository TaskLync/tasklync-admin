'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { GATE_LABEL, mult, pct, pts } from '@/components/ranking/explain-ui'
import type { RankingExplain } from '@/types/ranking'
import { formatDateTime } from '@/components/bookings/booking-ui'

function Row({ label, hint, value, tone }: { label: string; hint?: string; value: string; tone?: 'bad' | 'good' }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-gray-100 py-2 first:border-t-0">
      <div>
        <p className="text-sm text-gray-900">{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <span className={`shrink-0 text-sm font-medium ${tone === 'bad' ? 'text-warning' : tone === 'good' ? 'text-success' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

export default function ExplainAdjustments({ e }: { e: RankingExplain }) {
  const m = e.multipliers
  const b = e.boost
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">2. Penalties and multipliers</h2>
        <p className="mb-2 text-xs text-gray-500">The weighted total is multiplied by these. x1.00 means no effect.</p>
        <Row label="Low rating floor" hint="Applies with enough reviews and a low smoothed rating" value={mult(m.quality)} tone={m.quality < 1 ? 'bad' : undefined} />
        <Row label="Low reliability floor" hint="Applies with enough recent jobs and low acceptance / completion" value={mult(m.reliability)} tone={m.reliability < 1 ? 'bad' : undefined} />
        <Row label="Ranking flags (admin / system)" hint="Product of all active flags, 0.2 to 1.25" value={mult(m.flag)} tone={m.flag < 1 ? 'bad' : m.flag > 1 ? 'good' : undefined} />
        <Row label="Total multiplier" value={mult(m.product)} />
        <Row label="Score after penalties" hint={`${pts(e.weighted.points)} ${mult(m.product)}`} value={pts(e.afterFloors)} />
      </Card>

      <Card className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">3. Boost points</h2>
          <Badge tone={b.gatePass ? 'success' : 'warning'}>{b.gatePass ? 'Gate passed' : 'Gate failed'}</Badge>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          A small bonus, never more than {pts(b.cap)} points, and only for workers who pass every gate below.
        </p>
        <Row label="Featured" value={pts(b.featured)} />
        <Row label="Top rated badge" value={pts(b.topRated)} />
        <Row label="Background verified badge" value={pts(b.backgroundVerified)} />
        <Row
          label="Live offer"
          hint={b.promotion.points > 0 ? `Best discount ${b.promotion.bestPct.toFixed(0)}%${b.promotion.until ? `, until ${formatDateTime(b.promotion.until)}` : ''}` : 'No live automatic offer'}
          value={pts(b.promotion.points)}
        />
        <Row label="Total before cap" hint={`Cap ${pts(b.cap)}`} value={`${pts(b.rawTotal)} -> ${pts(b.cappedTotal)}`} />
        <div className="mt-2 rounded-md bg-gray-50 p-3">
          <p className="mb-1 text-xs font-medium text-gray-700">Gates (all must pass)</p>
          {b.gates.map((g) => (
            <p key={g.key} className={`text-xs ${g.pass ? 'text-gray-600' : 'text-warning'}`}>
              {g.pass ? 'Pass' : 'Fail'}: {GATE_LABEL[g.key] ?? g.key} is {pct(g.value)}, needs at least {pct(g.min)}
            </p>
          ))}
        </div>
        <Row label="Boost applied" value={pts(b.applied)} tone={b.applied > 0 ? 'good' : undefined} />
        <Row label="Final score" hint={`${pts(e.afterFloors)} + ${pts(b.applied)}`} value={pts(e.finalScore)} />
      </Card>
    </div>
  )
}