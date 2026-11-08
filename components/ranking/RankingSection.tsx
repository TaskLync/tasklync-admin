'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'
import { rankingActions, useRankingConfigs } from '@/hooks/useRanking'
import { RANKING_TERMS, TERM_LABEL } from '@/lib/ranking-constants'
import { formatDateTime } from '@/components/bookings/booking-ui'
import type { RankingConfig } from '@/types/ranking'
import ConfigEditorDialog from './ConfigEditorDialog'
import OverridesPanel from './OverridesPanel'
import SimulatePanel from './SimulatePanel'

type Tab = 'versions' | 'overrides' | 'simulate'

export default function RankingSection() {
  const { configs, isLoading, error, mutate } = useRankingConfigs()
  const canConfig = usePermission('ranking:config')
  const [tab, setTab] = useState<Tab>('versions')
  const [editor, setEditor] = useState<{ base?: RankingConfig } | null>(null)
  const [activating, setActivating] = useState<RankingConfig | null>(null)
  const [shadowFor, setShadowFor] = useState<RankingConfig | null>(null)
  const [pct, setPct] = useState('5')

  const active = configs.find((c) => c.isActive)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-1">
          {(['versions', 'overrides', 'simulate'] as const).map((t) => (
            <button
              key={t} onClick={() => setTab(t)}
              className={`-mb-px h-9 border-b-2 px-3 text-sm ${tab === t ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]' : 'border-transparent text-gray-500'}`}
            >
              {t === 'versions' ? 'Versions' : t === 'overrides' ? 'Category and city overrides' : 'Simulate'}
            </button>
          ))}
        </div>
        {tab === 'versions' && canConfig && (
          <Button className="mb-1" onClick={() => setEditor({ base: active ?? configs[0] })}>New version</Button>
        )}
      </div>

      {tab === 'versions' && (
        <>
          {!canConfig && <p className="text-xs text-gray-500">You have view-only access. Only Super Admins change ranking.</p>}
          {isLoading && <div className="h-40 animate-pulse rounded-lg bg-gray-100" />}
          {error && <p className="text-sm text-gray-500">Couldn't load ranking versions. Check SEARCH_SERVICE_URL (port 3019).</p>}
          {configs.map((c) => (
            <div key={c.version} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Version {c.version}</h3>
                  {c.isActive && <Badge tone="success">Active</Badge>}
                  {c.shadowEnabled && <Badge tone="info">Shadow {c.shadowSamplePct}%</Badge>}
                  {!c.isActive && !c.shadowEnabled && <Badge tone="neutral">Inactive</Badge>}
                </div>
                {canConfig && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditor({ base: c })}>New version from this</Button>
                    {!c.isActive && c.shadowEnabled && (
                      <Button size="sm" variant="secondary" onClick={() => rankingActions.shadow(c.version, false).then(() => { toast.success('Shadow stopped'); mutate() }).catch((e) => toast.error(e.message))}>
                        Stop shadow
                      </Button>
                    )}
                    {!c.isActive && !c.shadowEnabled && (
                      <Button size="sm" variant="secondary" onClick={() => setShadowFor(c)}>Run in shadow</Button>
                    )}
                    {!c.isActive && <Button size="sm" onClick={() => setActivating(c)}>{active && c.version < active.version ? 'Roll back to this' : 'Activate'}</Button>}
                  </div>
                )}
              </div>
              {c.note && <p className="mt-1 text-xs text-gray-500">{c.note}</p>}
              <p className="mt-1 text-xs text-gray-400">
                Created {c.createdAt ? formatDateTime(c.createdAt) : 'n/a'}
                {c.activatedAt ? ` · activated ${formatDateTime(c.activatedAt)}` : ''} · quality prior {c.priorMean} stars x {c.priorWeight} reviews
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {RANKING_TERMS.filter((t) => (c.weights[t] ?? 0) > 0)
                  .sort((a, b) => (c.weights[b] ?? 0) - (c.weights[a] ?? 0))
                  .map((t) => (
                    <span key={t} title={TERM_LABEL[t]} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {t} {Number(c.weights[t]).toFixed(2)}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'overrides' && <OverridesPanel />}
      {tab === 'simulate' && <SimulatePanel configs={configs} />}

      {editor && (
        <ConfigEditorDialog
          base={editor.base} onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); mutate() }}
        />
      )}

      <ConfirmDialog
        open={activating !== null} requireReason destructive={false}
        title={`Activate version ${activating?.version}?`}
        description="Search results change within about a minute for everyone. Run a simulation and a shadow period first. To roll back, activate the previous version."
        confirmLabel="Activate"
        onClose={() => setActivating(null)}
        onConfirm={async (reason) => {
          if (!activating) return
          await rankingActions.activate(activating.version, reason!)
          toast.success(`Version ${activating.version} is active`)
          await mutate()
        }}
      />

      <ConfirmDialog
        open={shadowFor !== null} destructive={false}
        title={`Run version ${shadowFor?.version} in shadow?`}
        description="Customers keep seeing the active version. The shadow version's top 10 is logged for a share of page-1 searches so you can compare."
        confirmLabel="Start shadow"
        onClose={() => setShadowFor(null)}
        onConfirm={async () => {
          if (!shadowFor) return
          await rankingActions.shadow(shadowFor.version, true, Number(pct) || 5)
          toast.success('Shadow started')
          await mutate()
        }}
      >
        <Input label="Share of searches (1 to 100 %)" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
      </ConfirmDialog>
    </div>
  )
}