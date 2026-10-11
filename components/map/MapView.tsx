// components/map/MapView.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  EMPTY_FC,
  demandToGeoJson,
  jobsToGeoJson,
  routesToGeoJson,
  workersToGeoJson,
  type GeoFC,
} from '@/lib/map-geo'
import { JOB_COLOR, MAP_STYLE, PRESENCE_COLOR, ROUTE_COLOR } from '@/lib/map-constants'
import type {
  DemandCell,
  DemandMode,
  MapJob,
  MapLayerKey,
  MapViewState,
  MapWorker,
} from '@/types/map'

interface Props {
  token: string
  view: MapViewState
  workers: MapWorker[]
  jobs: MapJob[]
  demandCells: DemandCell[]
  demandMode: DemandMode
  layers: Record<MapLayerKey, boolean>
  selectedWorkerId: string | null
  selectedJobId: string | null
  onSelectWorker: (id: string | null) => void
  onSelectJob: (id: string | null) => void
}

// ---------- Mapbox layer ids ----------
const LAYER_IDS: Record<MapLayerKey, string[]> = {
  workers: ['workers-circle', 'workers-selected'],
  jobs: ['jobs-circle', 'jobs-selected'],
  routes: ['routes-solid', 'routes-dashed'],
  demand: ['demand-heat'],
}

const HIT_LAYERS = ['workers-circle', 'jobs-circle']

// Mapbox expression arrays are awkward to type; one tiny cast helper keeps the code readable.
const expr = (e: unknown) => e as mapboxgl.ExpressionSpecification

// Derived from Mapbox itself, so no @types/geojson install is needed.
type GeoJsonData = Parameters<mapboxgl.GeoJSONSource['setData']>[0]

// Mapbox's GeoJSONFeature type does not declare `properties` in some versions,
// but it exists at runtime. Read it safely here.
function featureId(f: unknown): string | null {
  const props = (f as { properties?: Record<string, unknown> } | undefined)?.properties
  return props?.id != null ? String(props.id) : null
}

const PRESENCE_COLOR_EXPR = expr([
  'match',
  ['get', 'presence'],
  ...Object.entries(PRESENCE_COLOR).flat(),
  PRESENCE_COLOR.offline,
])

const JOB_COLOR_EXPR = expr([
  'match',
  ['get', 'status'],
  'IN_PROGRESS',
  JOB_COLOR.IN_PROGRESS,
  JOB_COLOR.ACCEPTED,
])

const DEMAND_RAMP = expr([
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0, 'rgba(191,219,254,0)',
  0.2, 'rgba(191,219,254,0.6)',
  0.45, '#60A5FA',
  0.7, '#2563EB',
  1, '#1E3A8A',
])

const UNSERVED_RAMP = expr([
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0, 'rgba(254,243,199,0)',
  0.2, 'rgba(254,243,199,0.6)',
  0.45, '#FCD34D',
  0.7, '#F97316',
  1, '#DC2626',
])

function setData(map: mapboxgl.Map, sourceId: string, fc: GeoFC) {
  const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
  src?.setData(fc as unknown as GeoJsonData)
}

function addSourcesAndLayers(map: mapboxgl.Map) {
  for (const id of ['demand', 'routes', 'jobs', 'workers']) {
    map.addSource(id, { type: 'geojson', data: EMPTY_FC as unknown as GeoJsonData })
  }

  // Order = draw order: heatmap at the bottom, worker dots on top.
  map.addLayer({
    id: 'demand-heat',
    type: 'heatmap',
    source: 'demand',
    paint: {
      'heatmap-weight': expr(['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1]),
      'heatmap-intensity': expr(['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 1.6]),
      'heatmap-radius': expr(['interpolate', ['linear'], ['zoom'], 4, 14, 9, 40, 13, 80]),
      'heatmap-color': UNSERVED_RAMP,
      'heatmap-opacity': 0.75,
    },
  })

  map.addLayer({
    id: 'routes-solid',
    type: 'line',
    source: 'routes',
    filter: expr(['==', ['get', 'status'], 'IN_PROGRESS']) as never,
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': ROUTE_COLOR.IN_PROGRESS, 'line-width': 2, 'line-opacity': 0.85 },
  })
  map.addLayer({
    id: 'routes-dashed',
    type: 'line',
    source: 'routes',
    filter: expr(['==', ['get', 'status'], 'ACCEPTED']) as never,
    paint: {
      'line-color': ROUTE_COLOR.ACCEPTED,
      'line-width': 1.5,
      'line-dasharray': [2, 2],
      'line-opacity': 0.8,
    },
  })

  map.addLayer({
    id: 'jobs-circle',
    type: 'circle',
    source: 'jobs',
    paint: {
      'circle-radius': expr(['interpolate', ['linear'], ['zoom'], 4, 4, 10, 6, 14, 9]),
      'circle-color': JOB_COLOR_EXPR,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'jobs-selected',
    type: 'circle',
    source: 'jobs',
    filter: expr(['==', ['get', 'id'], '']) as never,
    paint: {
      'circle-radius': 13,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#1F6F5F',
      'circle-stroke-width': 3,
    },
  })

  map.addLayer({
    id: 'workers-circle',
    type: 'circle',
    source: 'workers',
    paint: {
      'circle-radius': expr(['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 6, 14, 9]),
      'circle-color': PRESENCE_COLOR_EXPR,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 1.5,
      'circle-opacity': expr(['match', ['get', 'presence'], 'offline', 0.7, 1]),
    },
  })
  map.addLayer({
    id: 'workers-selected',
    type: 'circle',
    source: 'workers',
    filter: expr(['==', ['get', 'id'], '']) as never,
    paint: {
      'circle-radius': 13,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#1F6F5F',
      'circle-stroke-width': 3,
    },
  })
}

export default function MapView({
  token,
  view,
  workers,
  jobs,
  demandCells,
  demandMode,
  layers,
  selectedWorkerId,
  selectedJobId,
  onSelectWorker,
  onSelectJob,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const initialView = useRef(view)
  const handlers = useRef({ onSelectWorker, onSelectJob })
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    handlers.current = { onSelectWorker, onSelectJob }
  }, [onSelectWorker, onSelectJob])

  // ---- Create the map once ----
  useEffect(() => {
    let cancelled = false
    let map: mapboxgl.Map | null = null
    let observer: ResizeObserver | null = null

    ;(async () => {
      try {
        const mod = await import('mapbox-gl')
        const mb = mod.default
        if (cancelled || !containerRef.current) return

        mb.accessToken = token
        map = new mb.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center: initialView.current.center,
          zoom: initialView.current.zoom,
          attributionControl: true,
        })
        mapRef.current = map
        map.addControl(new mb.NavigationControl({ showCompass: false }), 'bottom-right')

        map.on('load', () => {
          if (!map) return
          addSourcesAndLayers(map)

          const hit = (e: mapboxgl.MapMouseEvent) =>
            map!.queryRenderedFeatures(
              [
                [e.point.x - 6, e.point.y - 6],
                [e.point.x + 6, e.point.y + 6],
              ],
              { layers: HIT_LAYERS }
            )

          map.on('click', (e) => {
            const features = hit(e)
            const worker = features.find((f) => f.layer?.id === 'workers-circle')
            const job = features.find((f) => f.layer?.id === 'jobs-circle')
            if (worker) {
              handlers.current.onSelectJob(null)
              handlers.current.onSelectWorker(featureId(worker))
            } else if (job) {
              handlers.current.onSelectWorker(null)
              handlers.current.onSelectJob(featureId(job))
            } else {
              handlers.current.onSelectWorker(null)
              handlers.current.onSelectJob(null)
            }
          })

          map.on('mousemove', (e) => {
            map!.getCanvas().style.cursor = hit(e).length ? 'pointer' : ''
          })

          setReady(true)
        })

        // The sidebar can collapse and change the container width without a window resize.
        observer = new ResizeObserver(() => map?.resize())
        observer.observe(containerRef.current)
      } catch (err) {
        console.error('[MapView] init failed', err)
        setInitError('The map could not be loaded.')
      }
    })()

    return () => {
      cancelled = true
      observer?.disconnect()
      map?.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [token])

  // ---- Data → sources ----
  const workersFc = useMemo(() => workersToGeoJson(workers), [workers])
  const jobsFc = useMemo(() => jobsToGeoJson(jobs), [jobs])
  const routesFc = useMemo(() => routesToGeoJson(jobs), [jobs])
  const demandFc = useMemo(() => demandToGeoJson(demandCells, demandMode), [demandCells, demandMode])

  useEffect(() => {
    if (ready && mapRef.current) setData(mapRef.current, 'workers', workersFc)
  }, [ready, workersFc])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    setData(mapRef.current, 'jobs', jobsFc)
    setData(mapRef.current, 'routes', routesFc)
  }, [ready, jobsFc, routesFc])

  useEffect(() => {
    if (ready && mapRef.current) setData(mapRef.current, 'demand', demandFc)
  }, [ready, demandFc])

  // ---- Heatmap colour ramp follows the mode ----
  useEffect(() => {
    if (!ready || !mapRef.current) return
    mapRef.current.setPaintProperty(
      'demand-heat',
      'heatmap-color',
      demandMode === 'unserved' ? UNSERVED_RAMP : DEMAND_RAMP
    )
  }, [ready, demandMode])

  // ---- Layer visibility ----
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(Object.keys(LAYER_IDS) as MapLayerKey[]).forEach((key) => {
      for (const id of LAYER_IDS[key]) {
        map.setLayoutProperty(id, 'visibility', layers[key] ? 'visible' : 'none')
      }
    })
  }, [ready, layers])

  // ---- Selection ring ----
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setFilter('workers-selected', expr(['==', ['get', 'id'], selectedWorkerId ?? '']) as never)
    map.setFilter('jobs-selected', expr(['==', ['get', 'id'], selectedJobId ?? '']) as never)
  }, [ready, selectedWorkerId, selectedJobId])

  // ---- Fly when the parent asks (city buttons, worker search) ----
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.flyTo({ center: view.center, zoom: view.zoom, essential: true, duration: 1200 })
  }, [ready, view])

  if (initError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-gray-500">
        {initError} Check <span className="mx-1 font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</span> and your network.
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}