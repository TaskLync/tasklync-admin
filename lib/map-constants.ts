// lib/map-constants.ts
// Shared by server routes AND client components. No server-only imports here.
import type { WorkerPresence } from '@/types/worker'
import type { MapJobStatus, MapLayerKey, MapViewState } from '@/types/map'

// Colorful with terrain, parks and water
// export const MAP_STYLE = 'mapbox://styles/mapbox/outdoors-v12'

export const MAP_STYLE = 'mapbox://styles/mapbox/light-v11'

// Satellite photo with road and place labels
// export const MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12'

/** [lng, lat] — Mapbox order. */
export const PAKISTAN_VIEW = { center: [69.3451, 30.3753] as [number, number], zoom: 4.8 }

export const MAP_CITIES = [
  { name: 'Lahore', center: [74.3587, 31.5204] as [number, number], zoom: 11 },
  { name: 'Karachi', center: [67.0011, 24.8607] as [number, number], zoom: 10.5 },
  { name: 'Islamabad', center: [73.0479, 33.6844] as [number, number], zoom: 11 },
  { name: 'Rawalpindi', center: [73.0169, 33.5651] as [number, number], zoom: 11.5 },
  { name: 'Faisalabad', center: [73.135, 31.4504] as [number, number], zoom: 11.5 },
] as const

export function viewForCity(city: string, key: number): MapViewState {
  const hit = MAP_CITIES.find((c) => c.name === city)
  return hit
    ? { center: hit.center, zoom: hit.zoom, key }
    : { center: PAKISTAN_VIEW.center, zoom: PAKISTAN_VIEW.zoom, key }
}

// ---- Polling (no admin WebSocket yet) ----
export const WORKERS_REFRESH_MS = 5_000
export const JOBS_REFRESH_MS = 15_000
export const DEMAND_REFRESH_MS = 60_000

// ---- Server limits ----
export const MAP_WORKER_LIMIT = 3000
export const MAP_JOB_LIMIT = 1000

// ---- Demand ----
export const DEMAND_HOURS = [6, 24, 72, 168] as const
export const DEFAULT_DEMAND_HOURS = 24
/** ~2 km cells. Must match the p_grid default in get_map_demand_cells(). */
export const DEMAND_GRID_DEG = 0.02

export function parseDemandHours(value: string | null | undefined): number {
  const n = Number(value)
  return (DEMAND_HOURS as readonly number[]).includes(n) ? n : DEFAULT_DEMAND_HOURS
}

export const DEMAND_HOURS_LABEL: Record<number, string> = {
  6: 'Last 6 hours',
  24: 'Last 24 hours',
  72: 'Last 3 days',
  168: 'Last 7 days',
}

// ---- Colors ----
export const PRESENCE_COLOR: Record<WorkerPresence, string> = {
  online: '#16A34A', // green  — online and available
  on_job: '#EA580C', // orange — in an active booking
  away: '#EAB308', // yellow — seen 90 s to 10 min ago
  paused: '#DC2626', // red    — manually paused
  offline: '#9CA3AF', // gray   — offline
}

export const PRESENCE_ORDER: WorkerPresence[] = ['online', 'on_job', 'away', 'paused', 'offline']

export const JOB_COLOR: Record<MapJobStatus, string> = {
  IN_PROGRESS: '#DC2626', // same red as the job-site dot on the booking page
  ACCEPTED: '#D97706',
}

export const ROUTE_COLOR: Record<MapJobStatus, string> = {
  IN_PROGRESS: '#2563EB',
  ACCEPTED: '#9CA3AF',
}

export const LAYER_LABEL: Record<MapLayerKey, string> = {
  workers: 'Workers',
  jobs: 'Job sites',
  routes: 'Worker → job lines',
  demand: 'Demand heatmap',
}