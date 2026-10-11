// lib/map-geo.ts
// Pure client-safe helpers that turn API rows into GeoJSON for Mapbox sources.
import type { DemandCell, DemandMode, MapJob, MapWorker } from '@/types/map'

type Props = Record<string, string | number | boolean | null>

type PointFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: Props
}
type LineFeature = {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: Props
}

export interface GeoFC<F = PointFeature | LineFeature> {
  type: 'FeatureCollection'
  features: F[]
}

export const EMPTY_FC: GeoFC = { type: 'FeatureCollection', features: [] }

export function workersToGeoJson(workers: MapWorker[]): GeoFC {
  return {
    type: 'FeatureCollection',
    features: workers.map<PointFeature>((w) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
      properties: { id: w.id, presence: w.presence },
    })),
  }
}

export function jobsToGeoJson(jobs: MapJob[]): GeoFC {
  return {
    type: 'FeatureCollection',
    features: jobs.map<PointFeature>((j) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [j.jobLng, j.jobLat] },
      properties: { id: j.id, status: j.status },
    })),
  }
}

/** Only jobs whose worker has a known position get a line. */
export function routesToGeoJson(jobs: MapJob[]): GeoFC {
  return {
    type: 'FeatureCollection',
    features: jobs
      .filter((j) => j.workerLat !== null && j.workerLng !== null)
      .map<LineFeature>((j) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [j.workerLng as number, j.workerLat as number],
            [j.jobLng, j.jobLat],
          ],
        },
        properties: { id: j.id, status: j.status },
      })),
  }
}

/** weight is normalised to 0..1 so the heatmap ramp is the same whatever the volume. */
export function demandToGeoJson(cells: DemandCell[], mode: DemandMode): GeoFC {
  const value = (c: DemandCell) => (mode === 'unserved' ? c.unserved : c.demand)
  const max = Math.max(1, ...cells.map(value))
  return {
    type: 'FeatureCollection',
    features: cells
      .filter((c) => value(c) > 0)
      .map<PointFeature>((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: { weight: value(c) / max },
      })),
  }
}