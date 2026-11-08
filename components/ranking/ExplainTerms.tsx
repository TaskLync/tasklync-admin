'use client'

import { Card } from '@/components/ui/Card'
import { TERM_LABEL, type RankingTerm } from '@/lib/ranking-constants'
import { NOT_APPLIED_TEXT, TERM_HELP, pct, pts } from '@/components/ranking/explain-ui'
import type { RankingExplain } from '@/types/ranking'

export default function ExplainTerms({ e }: { e: RankingExplain }) {
  const rows = [...e.terms].sort((a, b) => Number(b.applies) - Number(a.applies) || b.points - a.points)
  const max = Math.max(0.0001, ...rows.map((r) => r.points))

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">1. Score terms</h2>
      <p className="mb-3 text-xs text-gray-500">
        Each term is a value from 0% to 100%. Points = value x its share of the total weight x 100. Terms that do not apply to this search are left out and the other weights are scaled up to fill 100%.
      </p>
      {e.weighted.fallbackUsed && (
        <p className="mb-3 rounded-md bg-amber-50 p-2 text-xs text-amber-700">All weights are 0, so the rating alone is used (fallback).</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400">
              <th className="pb-2 pr-3 font-medium">Term</th>
              <th className="pb-2 pr-3 font-medium">Worker value</th>
              <th className="pb-2 pr-3 text-right font-medium">Weight share</th>
              <th className="pb-2 pr-3 font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.term} className={`border-t border-gray-100 align-top ${t.applies ? '' : 'text-gray-400'}`}>
                <td className="py-2 pr-3">
                  <p className="font-medium text-gray-900">{TERM_LABEL[t.term as RankingTerm] ?? t.term}</p>
                  <p className="text-xs text-gray-400">{t.applies ? TERM_HELP[t.term as RankingTerm] : (t.notAppliedReason && NOT_APPLIED_TEXT[t.notAppliedReason]) ?? ''}</p>
                </td>
                <td className="w-48 py-2 pr-3">
                  {t.applies && t.value !== null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, t.value * 100)}%` }} /></div>
                      <span className="w-10 text-right text-xs">{pct(t.value)}</span>
                    </div>
                  ) : '-'}
                </td>
                <td className="py-2 pr-3 text-right text-xs">{t.applies ? `${(t.weightShare * 100).toFixed(1)}%` : '-'}</td>
                <td className="w-40 py-2 pr-3">
                  {t.applies ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-info" style={{ width: `${(t.points / max) * 100}%` }} /></div>
                      <span className="w-10 text-right text-xs font-medium text-gray-900">{pts(t.points)}</span>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 text-sm font-semibold text-gray-900">
              <td className="pt-2" colSpan={3}>Weighted total (out of 100)</td>
              <td className="pt-2">{pts(e.weighted.points)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}