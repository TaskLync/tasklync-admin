// components/map/MapSection.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { useWorkerFilterOptions } from '@/hooks/useWorkers'
import { useMapDemand, useMapFilters, useMapJobs, useMapWorkers } from '@/hooks/useMap'
import {
  DEFAULT_DEMAND_HOURS,
  MAP_CITIES,
  PAKISTAN_VIEW,
  viewForCity,
} from '@/lib/map-constants'
import type { DemandMode, MapLayerKey, MapViewState, MapWorker } from '@/types/map'
import MapView from './MapView'
import MapControlsPanel from './MapControlsPanel'
import { JobPreviewCard, WorkerPreviewCard } from './MapPreviewCards'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

function Banner({ children, tone }: { children: React.ReactNode; tone: 'warning' | 'danger' }) {
  return (
    <div
      className={
        tone === 'danger'
          ? 'rounded-md bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626] shadow-sm'
          : 'rounded-md bg-[#FEF3C7] px-3 py-2 text-xs text-[#D97706] shadow-sm'
      }
    >
      {children}
    </div>
  )
}

export default function MapSection() {
  const searchParams = useSearchParams()
  const cityParam = searchParams.get('city')
  const workerParam = searchParams.get('workerId')
  const validCity = MAP_CITIES.some((c) => c.name === cityParam) ? (cityParam as string) : 'all'

  const { filters, update } = useMapFilters({
    city: validCity,
    includeOffline: Boolean(workerParam), // a deep-linked worker may be offline
  })
  const { categories } = useWorkerFilterOptions()

  const [live, setLive] = useState(true)
  const [layers, setLayers] = useState<Record<MapLayerKey, boolean>>({
    workers: true,
    jobs: true,
    routes: true,
    demand: false,
  })
  const [demandMode, setDemandMode] = useState<DemandMode>('unserved')
  const [demandHours, setDemandHours] = useState<number>(DEFAULT_DEMAND_HOURS)
  const [view, setView] = useState<MapViewState>(() =>
    validCity === 'all'
      ? { center: PAKISTAN_VIEW.center, zoom: PAKISTAN_VIEW.zoom, key: 0 }
      : viewForCity(validCity, 0)
  )
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const w = useMapWorkers(filters, live)
  const j = useMapJobs(filters, live)
  const d = useMapDemand(filters, demandHours, layers.demand, live)

  const workers = useMemo(() => w.workers?.data ?? [], [w.workers])
  const jobs = useMemo(() => j.jobs?.data ?? [], [j.jobs])
  const demandCells = useMemo(() => d.demand?.cells ?? [], [d.demand])

  const selectedWorker = workers.find((x) => x.id === selectedWorkerId) ?? null
  const selectedJob = jobs.find((x) => x.id === selectedJobId) ?? null
  const routeCount = useMemo(() => jobs.filter((x) => x.workerLat !== null).length, [jobs])

  const flyTo = useCallback((center: [number, number], zoom: number) => {
    setView((v) => ({ center, zoom, key: v.key + 1 }))
  }, [])

  const handleCityChange = useCallback(
    (city: string) => {
      update({ city })
      setSelectedWorkerId(null)
      setSelectedJobId(null)
      const hit = MAP_CITIES.find((c) => c.name === city)
      if (hit) flyTo(hit.center, hit.zoom)
      else flyTo(PAKISTAN_VIEW.center, PAKISTAN_VIEW.zoom)
    },
    [update, flyTo]
  )

  const handleFindWorker = useCallback(
    (worker: MapWorker) => {
      setLayers((l) => ({ ...l, workers: true }))
      setSelectedJobId(null)
      setSelectedWorkerId(worker.id)
      flyTo([worker.lng, worker.lat], 14)
    },
    [flyTo]
  )

  // Deep link: /map?workerId=<uuid> selects and zooms to that worker once the data has loaded.
  const deepLinkDone = useRef(false)
  useEffect(() => {
    if (deepLinkDone.current || !workerParam || !w.workers) return
    deepLinkDone.current = true
    const hit = w.workers.data.find((x) => x.id === workerParam)
    if (hit) handleFindWorker(hit)
  }, [workerParam, w.workers, handleFindWorker])

  if (!TOKEN) {
    return (
      <div className="px-6 py-5">
        <Card className="max-w-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900">Mapbox token missing</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add <span className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</span> (a public <span className="font-mono">pk.</span>{' '}
            token) to <span className="font-mono">.env</span> and restart the dev server.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <MapControlsPanel
        filters={filters}
        onCityChange={handleCityChange}
        onFiltersChange={update}
        categories={categories}
        workerCounts={w.workers?.counts}
        jobCounts={j.jobs?.counts}
        workers={workers}
        routeCount={routeCount}
        onFindWorker={handleFindWorker}
        layers={layers}
        onToggleLayer={(key) => setLayers((l) => ({ ...l, [key]: !l[key] }))}
        demandMode={demandMode}
        onDemandMode={setDemandMode}
        demandHours={demandHours}
        onDemandHours={setDemandHours}
        demandInfo={
          d.demand
            ? { source: d.demand.source, fallback: d.demand.fallback, cells: d.demand.cells.length }
            : undefined
        }
        demandLoading={d.isLoading}
        live={live}
        onToggleLive={() => setLive((v) => !v)}
        generatedAt={w.workers?.generatedAt}
      />

      <div className="relative flex-1">
        <MapView
          token={TOKEN}
          view={view}
          workers={workers}
          jobs={jobs}
          demandCells={demandCells}
          demandMode={demandMode}
          layers={layers}
          selectedWorkerId={selectedWorker ? selectedWorker.id : null}
          selectedJobId={selectedJob ? selectedJob.id : null}
          onSelectWorker={setSelectedWorkerId}
          onSelectJob={setSelectedJobId}
        />

        {/* Status banners (top-left of the map) */}
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-sm flex-col gap-2">
          {(w.error || j.error) && (
            <div className="pointer-events-auto">
              <Banner tone="danger">
                Live data failed to refresh. Retrying…{' '}
                <button
                  onClick={() => {
                    w.mutate()
                    j.mutate()
                  }}
                  className="underline"
                >
                  Retry now
                </button>
              </Banner>
            </div>
          )}
          {!live && (
            <div className="pointer-events-auto">
              <Banner tone="warning">Live updates are paused. The map shows the last data received.</Banner>
            </div>
          )}
          {w.workers?.truncated && (
            <div className="pointer-events-auto">
              <Banner tone="warning">
                Showing the {w.workers.limit.toLocaleString()} most recently active workers. Pick a city or category to
                narrow it down.
              </Banner>
            </div>
          )}
          {j.jobs?.truncated && (
            <div className="pointer-events-auto">
              <Banner tone="warning">Showing the first {j.jobs.limit.toLocaleString()} active bookings.</Banner>
            </div>
          )}
        </div>

        {/* Preview card (top-right) */}
        {(selectedWorker || selectedJob) && (
          <div className="absolute right-3 top-3">
            {selectedWorker ? (
              <WorkerPreviewCard worker={selectedWorker} onClose={() => setSelectedWorkerId(null)} />
            ) : (
              selectedJob && <JobPreviewCard job={selectedJob} onClose={() => setSelectedJobId(null)} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}