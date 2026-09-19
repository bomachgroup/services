import type { BoundaryPoint } from './real-estate.types'

export function isValidBoundary(
  boundary: BoundaryPoint[] | null | undefined,
): boundary is BoundaryPoint[] {
  return Boolean(
    boundary &&
    boundary.length >= 3 &&
    boundary.every(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        (point.lat !== 0 || point.lng !== 0) &&
        point.lat >= -90 &&
        point.lat <= 90 &&
        point.lng >= -180 &&
        point.lng <= 180,
    ),
  )
}

export function boundaryPositions(boundary: BoundaryPoint[]): [number, number][] {
  return boundary.map((point) => [point.lat, point.lng])
}

export function centroidOf(boundary: BoundaryPoint[]): { lat: number; lng: number } | null {
  const valid = boundary.filter(
    (point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      (point.lat !== 0 || point.lng !== 0),
  )
  if (!valid.length) return null
  return {
    lat: valid.reduce((sum, point) => sum + point.lat, 0) / valid.length,
    lng: valid.reduce((sum, point) => sum + point.lng, 0) / valid.length,
  }
}
