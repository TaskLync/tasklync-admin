'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { rankingActions } from '@/hooks/useRanking'
import {
  DEFAULT_WEIGHTS, PARAM_FIELDS, PARAM_GROUPS, RANKING_TERMS, TERM_LABEL, getPath, setPath,
} from '@/lib/ranking-constants'
import type { RankingConfig } from '@/types/ranking'

export default function ConfigEditorDialog({
  base, onClose, onSaved,
}: { base?: RankingConfig; onClose: () => void; onSaved: () => void }) {
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(RANKING_TERMS.map((t) => [t, String(base?.weights?.[t] ?? DEFAULT_WEIGHTS[t])]))
  )
  const [params, setParams] = useState<Record<string, string>>(() =>
    Object.fromEntries(PARAM_FIELDS.map((p) => [p.path, String(getPath(base?.params, p.path) ?? p.def)]))
  )
  const [priorMean, setPriorMean] = useState(String(base?.priorMean ?? 4))
  const [priorWeight, setPriorWeight] = useState(String(base?.priorWeight ?? 5))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sum = useMemo(() => RANKING_TERMS.reduce((s, t) => s + (Number(weights[t]) || 0), 0), [weights])

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const w = Object.fromEntries(RANKING_TERMS.map((t) => [t, Number(weights[t])]))
      const p: Record<string, unknown> = {}
      for (const f of PARAM_FIELDS) setPath(p, f.path, Number(params[f.path]))
      const out = await rankingActions.createConfig({
        weights: w, params: p, priorMean: Number(priorMean), priorWeight: Number(priorWeight), note: note.trim() || undefined,
      })
      toast.success(`Version ${out.version} saved as inactive. Simulate it, run it in shadow, then activate.`)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">New ranking version{base ? ` (from version ${base.version})` : ''}</h2>
        <p className="mt-1 text-xs text-gray-500">
          Saved as <b>inactive</b>. Search never changes until you activate it. Terms that do not apply to a search (no text, no location) are dropped and the rest re-normalised, so the sum only needs to be about 1.
        </p>

        <h3 className="mt-4 text-sm font-semibold text-gray-900">
          Weights <span className={`ml-2 text-xs font-normal ${Math.abs(sum - 1) < 0.015 ? 'text-green-700' : 'text-amber-700'}`}>sum {sum.toFixed(2)}</span>
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {RANKING_TERMS.map((t) => (
            <Input
              key={t} label={TERM_LABEL[t]} type="number" step="0.01" min="0" max="1"
              value={weights[t]} onChange={(e) => setWeights({ ...weights, [t]: e.target.value })}
            />
          ))}
        </div>

        <h3 className="mt-5 text-sm font-semibold text-gray-900">Quality prior</h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Input label="Prior rating (stars)" type="number" step="0.1" min="0" max="5" value={priorMean} onChange={(e) => setPriorMean(e.target.value)} />
          <Input label="Prior weight (virtual reviews)" type="number" step="1" min="0" max="100" value={priorWeight} onChange={(e) => setPriorWeight(e.target.value)} />
        </div>

        {PARAM_GROUPS.map((g) => (
          <div key={g}>
            <h3 className="mt-5 text-sm font-semibold text-gray-900">{g}</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PARAM_FIELDS.filter((p) => p.group === g).map((p) => (
                <Input
                  key={p.path} label={p.label} type="number" step={p.step} min={p.min} max={p.max}
                  value={params[p.path]} onChange={(e) => setParams({ ...params, [p.path]: e.target.value })}
                  helperText={`${p.min} to ${p.max}`}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-5">
          <Input label="Note (what changed and why)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || sum <= 0}>{busy ? 'Saving…' : 'Save as new version'}</Button>
        </div>
      </div>
    </div>
  )
}