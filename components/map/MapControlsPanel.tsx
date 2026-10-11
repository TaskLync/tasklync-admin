// components/map/MapControlsPanel.tsx
'use client'

import { useState } from 'react'
import { Pause, Play, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import {
  DEMAND_HOURS,
  DEMAND_HOURS_LABEL,
  JOB_COLOR,
  MAP_CITIES,
  PRESENCE_COLOR,
  PRESENCE_ORDER,
  ROUTE_COLOR,
} from '@/lib/map-constants'
import { PRESENCE_LABEL } from '@/components/workers/worker-ui'
import type { CategoryOption } from '@/types/worker'
import type {
  DemandMode,
  MapFilters,
  MapJobCounts,
  MapLayerKey,
  MapWorker,
  MapWorkerCounts,
} from '@/types/map'

interface Props {
  filters: MapFilters
  onCityChange: (city: string) => void
  onFiltersChange: (patch: Partial<MapFilters>) => void
  categories: CategoryOption[]

  workerCounts?: MapWorkerCounts
  jobCounts?: MapJobCounts
  workers: MapWorker[]
  routeCount: number
  onFindWorker: (worker: MapWorker) => void

  layers: Record<MapLayerKey, boolean>
  onToggleLayer: (key: MapLayerKey) => void

  demandMode: DemandMode
  onDemandMode: (mode: DemandMode) => void
  demandHours: number
  onDemandHours: (hours: number) => void
  demandInfo?: { source: 'search' | 'bookings'; fallback: boolean; cells: number }
  demandLoading: boolean

  live: boolean
  onToggleLive: () => void
  generatedAt?: string
}

const SELECT_CLASS = 'h-9 w-full rounded-md border border-gray-300 px-3 text-sm'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-gray-100 px-4 py-3 last:border-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  )
}

function LayerRow({
  checked,
  onChange,
  label,
  swatch,
  count,
}: {
  checked: boolean
  onChange: () => void
  label: string
  swatch: React.ReactNode
  count?: number
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-gray-300 accent-[#1F6F5F]"
      />
      <span className="flex h-4 w-6 items-center justify-center">{swatch}</span>
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-gray-400">{count.toLocaleString()}</span>}
    </label>
  )
}

const Dot = ({ color }: { color: string }) => (
  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
)

export default function MapControlsPanel({
  filters,
  onCityChange,
  onFiltersChange,
  categories,
  workerCounts,
  jobCounts,
  workers,
  routeCount,
  onFindWorker,
  layers,
  onToggleLayer,
  demandMode,
  onDemandMode,
  demandHours,
  onDemandHours,
  demandInfo,
  demandLoading,
  live,
  onToggleLive,
  generatedAt,
}: Props) {
  const [query, setQuery] = useState('')
  const matches =
    query.trim().length >= 2
      ? workers.filter((w) => (w.name ?? '').toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
      : []

  const countFor = (p: (typeof PRESENCE_ORDER)[number]) =>
    !workerCounts
      ? undefined
      : p === 'on_job'
        ? workerCounts.onJob
        : workerCounts[p as 'online' | 'away' | 'paused' | 'offline']

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white">
      {/* Live counts */}
      <Section title="Live now">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-[#DCFCE7] px-3 py-2">
            <p className="text-xl font-semibold text-[#16A34A]">
              {workerCounts ? workerCounts.online.toLocaleString('en-PK') : '–'}
            </p>
            <p className="text-xs text-[#16A34A]">Workers online</p>
          </div>
          <div className="rounded-md bg-[#FEE2E2] px-3 py-2">
            <p className="text-xl font-semibold text-[#DC2626]">
              {jobCounts ? jobCounts.inProgress.toLocaleString('en-PK') : '–'}
            </p>
            <p className="text-xs text-[#DC2626]">Active bookings</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {workerCounts ? `${workerCounts.onJob} on a job · ` : ''}
          {jobCounts ? `${jobCounts.accepted} accepted, not started` : ''}
        </p>
        {workerCounts && workerCounts.noLocation > 0 && (
          <p className="mt-2 rounded-md bg-[#FEF3C7] px-2 py-1.5 text-xs text-[#D97706]">
            {workerCounts.noLocation} active worker{workerCounts.noLocation === 1 ? '' : 's'} have not sent GPS yet
            and cannot be drawn.
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onToggleLive}
            className={cn(
              'cursor-pointer flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-150',
              live
                ? 'border-[#1F6F5F] bg-[#1F6F5F]/10 text-[#1F6F5F]'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            {live ? <Pause size={13} /> : <Play size={13} />}
            {live ? 'Live · pause' : 'Paused · resume'}
          </button>
          <span className="text-xs text-gray-400">
            {generatedAt ? new Date(generatedAt).toLocaleTimeString('en-GB') : ''}
          </span>
        </div>
      </Section>

      {/* City */}
      <Section title="City">
        <div className="grid grid-cols-2 gap-1.5">
          {(['all', ...MAP_CITIES.map((c) => c.name)] as string[]).map((c) => (
            <button
              key={c}
              onClick={() => onCityChange(c)}
              className={cn(
                'cursor-pointer h-8 rounded-md border px-2 text-xs font-medium transition-colors duration-150',
                filters.city === c
                  ? 'border-[#1F6F5F] bg-[#1F6F5F] text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              )}
            >
              {c === 'all' ? 'All Pakistan' : c}
            </button>
          ))}
        </div>
      </Section>

      {/* Category + search */}
      <Section title="Filter">
        <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
        <select
          className={SELECT_CLASS}
          value={filters.categoryId}
          onChange={(e) => onFiltersChange({ categoryId: e.target.value })}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="mb-1 mt-3 block text-xs font-medium text-gray-700">Find a worker on the map</label>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-gray-400" />
          <Input
            className="w-full pl-8"
            placeholder="Type a name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {matches.length > 0 && (
          <ul className="mt-1 overflow-hidden rounded-md border border-gray-200">
            {matches.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => {
                    onFindWorker(w)
                    setQuery('')
                  }}
                  className="cursor-pointer flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  <Dot color={PRESENCE_COLOR[w.presence]} />
                  <span className="flex-1 truncate text-gray-800">{w.name ?? 'Unnamed'}</span>
                  <span className="text-xs text-gray-400">{PRESENCE_LABEL[w.presence]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && matches.length === 0 && (
          <p className="mt-1 text-xs text-gray-400">
            No match among the workers on the map
            {!filters.includeOffline && ' (offline workers are hidden)'}.
          </p>
        )}
      </Section>

      {/* Layers = legend */}
      <Section title="Layers">
        <LayerRow
          checked={layers.workers}
          onChange={() => onToggleLayer('workers')}
          label="Workers"
          swatch={<Dot color={PRESENCE_COLOR.online} />}
          count={workers.length}
        />
        {layers.workers && (
          <div className="mb-1 ml-8 flex flex-col gap-0.5 border-l border-gray-100 pl-3">
            {PRESENCE_ORDER.filter((p) => p !== 'offline').map((p) => (
              <div key={p} className="flex items-center gap-2 text-xs text-gray-500">
                <Dot color={PRESENCE_COLOR[p]} />
                <span className="flex-1">{PRESENCE_LABEL[p]}</span>
                <span className="text-gray-400">{countFor(p)?.toLocaleString() ?? '–'}</span>
              </div>
            ))}
            <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={filters.includeOffline}
                onChange={(e) => onFiltersChange({ includeOffline: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-gray-300 accent-[#1F6F5F]"
              />
              <Dot color={PRESENCE_COLOR.offline} />
              <span className="flex-1">Show offline</span>
              <span className="text-gray-400">{countFor('offline')?.toLocaleString() ?? '–'}</span>
            </label>
          </div>
        )}

        <LayerRow
          checked={layers.jobs}
          onChange={() => onToggleLayer('jobs')}
          label="Job sites"
          swatch={<Dot color={JOB_COLOR.IN_PROGRESS} />}
          count={jobCounts?.total}
        />
        <LayerRow
          checked={layers.routes}
          onChange={() => onToggleLayer('routes')}
          label="Worker → job lines"
          swatch={
            <span
              className="block h-0.5 w-5"
              style={{ backgroundColor: ROUTE_COLOR.IN_PROGRESS }}
            />
          }
          count={routeCount}
        />
        <LayerRow
          checked={layers.demand}
          onChange={() => onToggleLayer('demand')}
          label="Demand heatmap"
          swatch={<span className="h-3 w-5 rounded-sm bg-linear-to-r from-[#FCD34D] to-[#DC2626]" />}
          count={demandInfo?.cells}
        />
      </Section>

      {/* Demand controls */}
      {layers.demand && (
        <Section title="Demand heatmap">
          <div className="flex rounded-md border border-gray-300 p-0.5">
            {(['unserved', 'demand'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onDemandMode(m)}
                className={cn(
                  'cursor-pointer h-8 flex-1 rounded px-2 text-xs transition-colors duration-150',
                  demandMode === m
                    ? 'bg-[#1F6F5F]/10 font-medium text-[#1F6F5F]'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {m === 'unserved' ? 'Unserved' : 'All demand'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            {demandMode === 'unserved'
              ? 'Red = high demand, few online workers nearby. Recruit here.'
              : 'Where customers are searching or booking, regardless of supply.'}
          </p>

          <label className="mb-1 mt-3 block text-xs font-medium text-gray-700">Time window</label>
          <select
            className={SELECT_CLASS}
            value={demandHours}
            onChange={(e) => onDemandHours(Number(e.target.value))}
          >
            {DEMAND_HOURS.map((h) => (
              <option key={h} value={h}>
                {DEMAND_HOURS_LABEL[h]}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs text-gray-400">
            {demandLoading && !demandInfo
              ? 'Loading demand…'
              : demandInfo?.cells === 0
                ? 'No demand in this window.'
                : demandInfo?.fallback
                  ? 'Based on booking locations. Customer-search logging is not connected yet.'
                  : demandInfo?.source === 'search'
                    ? 'Based on customer searches.'
                    : ''}
          </p>
          <p className="mt-1 text-xs text-gray-400">The heatmap covers all cities (the city filter only moves the camera).</p>
        </Section>
      )}
    </aside>
  )
}