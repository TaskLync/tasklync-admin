'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/usePermission'
import { rankingActions } from '@/hooks/useRanking'
import { DEFAULT_WEIGHTS, RANKING_TERMS } from '@/lib/ranking-constants'
import type { RankingConfig, SimResult, SimRow } from '@/types/ranking'

const SAMPLE = 'ac repair, ac_repair, Lahore\nplumber\nelectrician, , Karachi'

// the strict weights schema in search-service needs exactly the 13 terms; old versions may carry a legacy "boost" key
const clean = (c: RankingConfig) =>
  Object.fromEntries(RANKING_TERMS.map((t) => [t, Number(c.weights[t] ?? DEFAULT_WEIGHTS[t])]))

function parseQueries(text: string) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20).map((l) => {
    const [q, categoryId, city] = l.split(',').map((s) => s.trim())
    return { q: q || undefined, categoryId: categoryId || undefined, city: city || undefined }
  })
}

function Column({ title, rows, other }: { title: string; rows: SimRow[]; other: SimRow[] }) {
  const otherRank = new Map(other.map((r) => [r.worker_id, r.rank]))
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500">{title}</p>
      <ol className="flex flex-col gap-0.5 text-xs">
        {rows.map((r) => {
          const o = otherRank.get(r.worker_id)
          return (
            <li key={r.worker_id} className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 odd:bg-gray-50">
              <span className="truncate">{r.rank}. {r.name ?? r.worker_id.slice(0, 8)}{r.boosted ? ' ★' : ''}</span>
              <span className="shrink-0 text-gray-400">
                {r.score}{o === undefined ? ' · new' : o !== r.rank ? ` · was ${o}` : ''}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function SimulatePanel({ configs }: { configs: RankingConfig[] }) {
  const canConfig = usePermission('ranking:config')
  const drafts = configs.filter((c) => !c.isActive)
  const [version, setVersion] = useState<number | ''>(drafts[0]?.version ?? '')
  const [text, setText] = useState(SAMPLE)
  const [top, setTop] = useState(10)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)

  if (!canConfig) return <p className="text-sm text-gray-500">Simulation is limited to Super Admins.</p>

  async function run() {
    const cand = configs.find((c) => c.version === version)
    if (!cand) return
    setBusy(true)
    try {
      const out = await rankingActions.simulate({
        candidate: { weights: clean(cand), params: cand.params, priorMean: cand.priorMean, priorWeight: cand.priorWeight },
        top, queries: parseQueries(text),
      })
      setResult(out.data)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500">
        Replays real searches against the <b>active</b> version and a candidate, side by side. Read-only: nothing is cached or logged. ★ = boosted by an offer or editorial points.
      </p>
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Candidate version</label>
          <select className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm" value={version} onChange={(e) => setVersion(Number(e.target.value))}>
            {configs.filter((c) => !c.isActive).map((c) => <option key={c.version} value={c.version}>Version {c.version}{c.note ? `: ${c.note.slice(0, 30)}` : ''}</option>)}
          </select>
          <label className="mb-1 mt-3 block text-xs font-medium text-gray-700">Results per query</label>
          <input type="number" min={3} max={20} className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm" value={top} onChange={(e) => setTop(Math.min(20, Math.max(3, Number(e.target.value) || 10)))} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">Queries, one per line: text, category id, city (all optional, up to 20)</label>
          <textarea className="h-28 w-full rounded-md border border-gray-300 p-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="sm:col-span-3 flex justify-end">
          <Button onClick={run} disabled={busy || version === ''}>{busy ? 'Running…' : 'Run simulation'}</Button>
        </div>
      </div>

      {result && (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
            Active version <b>{result.active_version}</b> vs candidate over <b>{result.summary.queries}</b> queries: average overlap <b>{(result.summary.avg_overlap_at_n * 100).toFixed(0)}%</b>.
            <span className="ml-2 text-xs text-gray-500">Review before activating: no verified, high-quality worker should drop out of the top 20 without a reason (launch gate G3).</span>
          </div>
          {result.results.map((r, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-sm font-medium text-gray-900">
                {r.query.q || 'Browse'}{r.query.categoryId ? ` · ${r.query.categoryId}` : ''}{r.query.city ? ` · ${r.query.city}` : ''}
                <span className="ml-2 text-xs font-normal text-gray-500">overlap {(r.overlap * 100).toFixed(0)}% · {r.moved.length} moved</span>
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Column title={`Active (v${result.active_version})`} rows={r.active} other={r.candidate} />
                <Column title="Candidate" rows={r.candidate} other={r.active} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}