// types/map.ts
import type { WorkerPresence } from '@/types/worker'

export type MapLayerKey = 'workers' | 'jobs' | 'routes' | 'demand'
export type DemandMode = 'demand' | 'unserved'
export type DemandSource = 'search' | 'bookings'
export type MapJobStatus = 'ACCEPTED' | 'IN_PROGRESS'

export interface MapFilters {
  city: string | 'all'
  categoryId: string | 'all'
  /** Offline workers are hidden by default (they are the bulk of the table and add noise). */
  includeOffline: boolean
}

/** The map flies whenever `key` changes. */
export interface MapViewState {
  center: [number, number] // [lng, lat]
  zoom: number
  key: number
}

// ---- Workers ----

export interface MapWorker {
  id: string
  name: string | null
  avatarUrl: string | null
  city: string | null
  categories: string | null
  avgRating: number
  totalReviews: number
  presence: WorkerPresence
  lat: number
  lng: number
  lastSeenAt: string | null
  locationUpdatedAt: string | null
  activeBookingId: string | null
}

export interface MapWorkerCounts {
  online: number
  away: number
  onJob: number
  paused: number
  offline: number
  /** online / away / on-job workers that have no worker_locations row yet (they cannot be drawn). */
  noLocation: number
}

export interface MapWorkersResponse {
  data: MapWorker[]
  counts: MapWorkerCounts
  truncated: boolean
  limit: number
  generatedAt: string
}

// ---- Active bookings ----

export interface MapJob {
  id: string
  status: MapJobStatus
  categoryId: string
  categoryName: string | null
  city: string | null
  amount: number
  currency: string
  scheduledAt: string
  startedAt: string | null
  updatedAt: string
  userName: string | null
  workerId: string | null
  workerName: string | null
  jobLat: number
  jobLng: number
  workerLat: number | null
  workerLng: number | null
  workerLocationAt: string | null
}

export interface MapJobCounts {
  inProgress: number
  accepted: number
  total: number
}

export interface MapJobsResponse {
  data: MapJob[]
  counts: MapJobCounts
  truncated: boolean
  limit: number
  generatedAt: string
}

// ---- Demand heatmap ----

export interface DemandCell {
  lat: number
  lng: number
  demand: number
  supply: number
  unserved: number
}

export interface MapDemandResponse {
  /** What actually produced the cells (may differ from what was requested). */
  source: DemandSource
  /** true when search_demand_log had no rows and booking locations were used instead. */
  fallback: boolean
  hours: number
  cells: DemandCell[]
  generatedAt: string
}