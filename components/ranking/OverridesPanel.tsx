'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { rankingActions, useRankingOverrides } from '@/hooks/useRanking'
import { RANKING_TERMS } from '@/lib/ranking-constants'
import type { RankingOverride } from '@/types/ranking'

export default function OverridesPanel() {
  const { overrides, isLoading, error, mutate } = useRankingOverrides()
  const canConfig = usePermission('ranking:config')
  const [scopeType, setScopeType] = useState<'CATEGORY' | 'CITY'>('CATEGORY')
  const [scopeValue, setScopeValue] = useState('')
  const [w, setW] = useState<Record<string, string>>({})
  const [paramsJson, setParamsJson] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<RankingOverride | null>(null)

  async function save() {
    setFormError(null)
    let params: Record<string, unknown> | undefined
    if (paramsJson.trim()) {
      try { params = JSON.parse(paramsJson) } catch { setFormError('Params must be valid JSON, for example {"boost":{"capPoints":4}}'); return }
    }
    const weights = Object.fromEntries(Object.entries(w).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]))
    if (Object.keys(weights).length === 0 && !params) { setFormError('Change at least one weight or parameter'); return }
    setBusy(true)
    try {
      await rankingActions.upsertOverride({
        scopeType, scopeValue: scopeValue.trim(), patch: { weights, params }, note: note.trim() || undefined,
      })
      toast.success('Override saved. It applies to matching searches within about a minute.')
      setScopeValue(''); setW({}); setParamsJson(''); setNote('')
      await mutate()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500">
        An override patches the active version for one category or one city. The city override is applied after the category one and wins on conflicts. Only the keys you fill are changed.
      </p>

      {isLoading && <div className="h-24 animate-pulse rounded-lg bg-gray-100" />}
      {error && <p className="text-sm text-gray-500">Couldn't load overrides.</p>}
      {!isLoading && overrides.length === 0 && <p className="text-sm text-gray-400">No active overrides.</p>}
      {overrides.map((o) => (
        <div key={o.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="info">{o.scopeType === 'CATEGORY' ? 'Category' : 'City'}</Badge>
              <b>{o.scopeValue}</b>
            </div>
            {o.note && <p className="mt-1 text-xs text-gray-500">{o.note}</p>}
            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-gray-500">{JSON.stringify(o.patch)}</pre>
          </div>
          {canConfig && <Button size="sm" variant="destructive" onClick={() => setRemoving(o)}>Remove</Button>}
        </div>
      ))}

      {canConfig && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">New or replacement override</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Scope</label>
              <select className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm" value={scopeType} onChange={(e) => setScopeType(e.target.value as 'CATEGORY' | 'CITY')}>
                <option value="CATEGORY">Category</option>
                <option value="CITY">City</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Input label={scopeType === 'CATEGORY' ? 'Category id (slug)' : 'City name'} placeholder={scopeType === 'CATEGORY' ? 'ac_repair' : 'Lahore'} value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} />
            </div>
          </div>
          <p className="mt-3 text-xs font-medium text-gray-700">Weights (leave empty to keep the active value)</p>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RANKING_TERMS.map((t) => (
              <Input key={t} label={t} type="number" step="0.01" min="0" max="1" value={w[t] ?? ''} onChange={(e) => setW({ ...w, [t]: e.target.value })} />
            ))}
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-700">Params patch (JSON, optional)</label>
            <textarea className="h-20 w-full rounded-md border border-gray-300 p-2 font-mono text-xs" value={paramsJson} onChange={(e) => setParamsJson(e.target.value)} placeholder='{"boost":{"capPoints":4}}' />
          </div>
          <div className="mt-3"><Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={busy || scopeValue.trim().length < 2}>{busy ? 'Saving…' : 'Save override'}</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null} destructive title="Remove this override?"
        description="Matching searches go back to the active version's values."
        confirmLabel="Remove" onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await rankingActions.removeOverride(removing.id)
          toast.success('Override removed')
          await mutate()
        }}
      />
    </div>
  )
}