'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { rankingActions, useWorkerRanking } from '@/hooks/useRanking'
import { FLAG_LABEL, FLAG_TYPES, type FlagType } from '@/lib/ranking-constants'
import { formatDateTime } from '@/components/bookings/booking-ui'

const d1 = (n: number) => n.toFixed(1)

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-gray-100 p-3" title={hint}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

export default function WorkerRankingPanel({ workerId }: { workerId: string }) {
  const { ranking: r, allowed, isLoading, error, mutate } = useWorkerRanking(workerId)
  const canFlag = usePermission('ranking:flag')
  const [revoking, setRevoking] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [flagType, setFlagType] = useState<FlagType>('QUALITY_PENALTY')
  const [multiplier, setMultiplier] = useState('0.8')
  const [reason, setReason] = useState('')
  const [expires, setExpires] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!allowed) return null

  async function addFlag() {
    setFormError(null)
    setBusy(true)
    try {
      await rankingActions.flag(workerId, {
        action: 'add', flagType, multiplier: Number(multiplier), reason: reason.trim(),
        expiresAt: expires ? new Date(expires).toISOString() : undefined,
      })
      toast.success('Flag added. The worker is re-ranked within seconds.')
      setAdding(false); setReason(''); setExpires('')
      await mutate()
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const s = r?.stats
  const activeFlags = (r?.flags ?? []).filter((f) => !f.revokedAt && (!f.expiresAt || new Date(f.expiresAt) > new Date()))
  const pastFlags = (r?.flags ?? []).filter((f) => !activeFlags.includes(f)).slice(0, 5)
  const decided = s ? s.acceptedD + s.rejectedD + s.expiredD : 0
  const outcomes = s ? s.completedD + s.workerCancelD + s.noShowD : 0

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Ranking</h2>
        <Link
          href={`/settings/ranking/explain/${workerId}`}
          className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Why this rank?
        </Link>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-gray-100" />
      ) : error || !r ? (
        <p className="text-sm text-gray-500">Couldn't load ranking data. <button onClick={() => mutate()} className="text-[#1F6F5F] hover:underline">Retry</button></p>
      ) : (
        <div className="flex flex-col gap-4">
          {!s ? (
            <p className="text-sm text-gray-500">No performance row yet. It is created by the hourly rollup (or the backfill script).</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Ranking multiplier" value={`x${s.rankingMultiplier.toFixed(2)}`} hint="Product of active flags, 0.2 to 1.25" />
                <Tile label="Acceptance (decayed)" value={decided > 0 ? `${Math.round((s.acceptedD / decided) * 100)}%` : 'n/a'} hint={`${s.halfLifeDays}-day half-life`} />
                <Tile label="Worker cancel + no-show" value={outcomes > 0 ? `${Math.round(((s.workerCancelD + s.noShowD) / outcomes) * 100)}%` : 'n/a'} />
                <Tile label="Repeat customers" value={`${Math.round(s.repeatRate * 100)}%`} hint="Capped at 3 jobs per customer" />
                <Tile label="Completed (lifetime)" value={String(s.completedTotal)} />
                <Tile label="Distinct customers" value={String(s.distinctCustomers)} />
                <Tile label="4+ star share" value={s.ratingNd > 0 ? `${Math.round((s.highNd / s.ratingNd) * 100)}%` : 'n/a'} hint="Visible reviews only, decayed" />
                <Tile label="Avg response" value={s.responseAvgSecs === null ? 'n/a' : `${Math.round(s.responseAvgSecs / 60)} min`} />
              </div>
              <p className="text-xs text-gray-400">
                Decayed counts: accepted {d1(s.acceptedD)}, rejected {d1(s.rejectedD)}, expired {d1(s.expiredD)}, completed {d1(s.completedD)},
                disputed {d1(s.disputedD)}. Computed {s.computedAt ? formatDateTime(s.computedAt) : 'never'}.
              </p>
            </>
          )}

          {r.topCustomers.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-700">Customer concentration (top 5, anonymised)</p>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                {r.topCustomers.map((c, i) => (
                  <span key={i} className={`rounded-md px-2 py-0.5 ${c.share > 0.4 ? 'bg-red-50 text-red-700' : 'bg-gray-100'}`}>
                    {c.completedCount} jobs · {Math.round(c.share * 100)}%
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">Above 40% with 10+ jobs triggers an automatic collusion flag (0.9).</p>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-700">Active flags</p>
              {canFlag && !adding && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>Add flag</Button>}
            </div>
            {activeFlags.length === 0 ? <p className="text-sm text-gray-400">None.</p> : (
              <ul className="flex flex-col gap-2">
                {activeFlags.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 rounded-md border border-gray-100 p-2 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone={f.multiplier < 1 ? 'warning' : 'success'}>{FLAG_LABEL[f.flagType as FlagType] ?? f.flagType}</Badge>
                        <span className="font-mono text-xs">x{f.multiplier.toFixed(2)}</span>
                        <span className="text-xs text-gray-400">{f.source === 'SYSTEM' ? 'automatic' : f.createdByEmail}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">{f.reason}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(f.createdAt)}{f.expiresAt ? ` · expires ${formatDateTime(f.expiresAt)}` : ''}</p>
                    </div>
                    {canFlag && <Button size="sm" variant="secondary" onClick={() => setRevoking(f.id)}>Revoke</Button>}
                  </li>
                ))}
              </ul>
            )}
            {pastFlags.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">Earlier: {pastFlags.map((f) => `${FLAG_LABEL[f.flagType as FlagType] ?? f.flagType}${f.revokedAt ? ' (revoked)' : ' (expired)'}`).join(', ')}</p>
            )}
          </div>

          {adding && (
            <div className="rounded-md border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Type</label>
                  <select className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm" value={flagType} onChange={(e) => setFlagType(e.target.value as FlagType)}>
                    {FLAG_TYPES.map((t) => <option key={t} value={t}>{FLAG_LABEL[t]}</option>)}
                  </select>
                </div>
                <Input label="Multiplier (0.2 to 1.25)" type="number" step="0.05" min="0.2" max="1.25" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} helperText="Below 1 demotes, above 1 boosts" />
                <Input label="Expires (optional)" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
              </div>
              <div className="mt-3"><Input label="Reason (shown in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
                <Button onClick={addFlag} disabled={busy || reason.trim().length < 5 || !Number(multiplier)}>{busy ? 'Saving…' : 'Add flag'}</Button>
              </div>
              <p className="mt-2 text-xs text-gray-400">A worker with a multiplier below 1 also loses the newcomer lift and is held to the strict-offer check (offers need admin approval).</p>
            </div>
          )}

          {r.daily.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-gray-700">Last {Math.min(14, r.daily.length)} days</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs text-gray-600">
                  <thead><tr className="text-left text-gray-400">
                    {['Day', 'Offered', 'Accepted', 'Rejected', 'Expired', 'Done', 'W-cancel', 'No-show'].map((h) => <th key={h} className="pr-3 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {r.daily.slice(0, 14).map((x) => (
                      <tr key={x.day}>
                        <td className="pr-3">{String(x.day).slice(0, 10)}</td><td>{x.offered}</td><td>{x.accepted}</td><td>{x.rejected}</td>
                        <td>{x.expired}</td><td>{x.completed}</td><td>{x.cancelledByWorker}</td><td>{x.noShow}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      <ConfirmDialog
        open={revoking !== null} requireReason destructive={false} title="Revoke this flag?"
        description="The worker's ranking multiplier is recalculated immediately."
        confirmLabel="Revoke" onClose={() => setRevoking(null)}
        onConfirm={async (reason2) => {
          if (!revoking) return
          await rankingActions.flag(workerId, { action: 'revoke', flagId: revoking, reason: reason2 })
          toast.success('Flag revoked')
          await mutate()
        }}
      />
    </Card>
  )
}