import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMemo } from 'react'
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet'

import type { BoundaryPoint, Property, PropertyStatus } from './real-estate.types'

const STATUS_COLORS: Record<PropertyStatus, string> = {
  available: '#15803d',
  reserved: '#b45309',
  under_offer: '#6d28d9',
  sold: '#b91c1c',
  hold: '#1d4ed8',
  'not-for-sale': '#475569',
}

function isValidBoundary(boundary: BoundaryPoint[]): boolean {
  return (
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
    )
  )
}

function boundaryPositions(boundary: BoundaryPoint[]): [number, number][] {
  return boundary.map((point) => [point.lat, point.lng])
}

function estateBoardLabel(property: Property) {
  if (property.plotNumber != null) return `Plot ${property.plotNumber}`
  const match = property.propertyName.match(/^plot\s*0*(\d+)$/i)
  if (match) return `Plot ${Number(match[1])}`
  return property.propertyName
}

function FitToBoundaries({ frames }: { frames: L.LatLngTuple[][] }) {
  const map = useMap()
  const framesKey = useMemo(() => JSON.stringify(frames), [frames])

  useMemo(() => {
    const points = JSON.parse(framesKey) as L.LatLngTuple[]
    if (points.length < 2) return
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
  }, [map, framesKey])

  return null
}

export interface EstateLocationMapProps {
  estateBoundary: BoundaryPoint[]
  properties: Property[]
}

export function EstateLocationMap({ estateBoundary, properties }: EstateLocationMapProps) {  const hasEstateBoundary = isValidBoundary(estateBoundary)
  const estateFrame = hasEstateBoundary ? boundaryPositions(estateBoundary) : null

  const plotFrames = useMemo(() => {
    return properties
      .filter((property) => isValidBoundary(property.boundary ?? []))
      .map((property) => ({
        property,
        positions: boundaryPositions(property.boundary ?? []),
      }))
  }, [properties])

  if (!estateFrame) return null

  const frames: L.LatLngTuple[][] = [estateFrame, ...plotFrames.map((f) => f.positions)]
  const flatPoints: L.LatLngTuple[] = frames.flat()

  return (
    <div className="specialized-estate-map" data-testid="estate-location-map">
      <MapContainer
        bounds={L.latLngBounds(flatPoints)}
        scrollWheelZoom={false}
        className="specialized-estate-map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polygon
          positions={estateFrame}
          pathOptions={{
            color: '#1f3d7a',
            weight: 2,
            fillColor: '#1f3d7a',
            fillOpacity: 0.08,
            dashArray: '6 4',
          }}
        >
          <Tooltip sticky>Estate boundary</Tooltip>
        </Polygon>
        {plotFrames.map(({ property, positions }) => {
          const stroke = STATUS_COLORS[property.status] ?? STATUS_COLORS.available
          return (
            <Polygon
              key={property.id}
              positions={positions}
              pathOptions={{
                color: stroke,
                weight: 1.5,
                fillColor: stroke,
                fillOpacity: 0.25,
              }}
            >
              <Tooltip sticky>
                <strong>{estateBoardLabel(property)}</strong>
                <br />
                {property.statusDisplay || property.status.replaceAll('_', ' ')}
              </Tooltip>
            </Polygon>
          )
        })}
        <FitToBoundaries frames={frames} />
      </MapContainer>
      <div className="specialized-estate-map-legend">
        <span>
          <i className="av" /> Available
        </span>
        <span>
          <i className="rs" /> Reserved
        </span>
        <span>
          <i className="sd" /> Sold
        </span>
        <span>
          <i className="hd" /> Hold / NFS
        </span>
        <span className="specialized-estate-map-legend-boundary">
          <i /> Estate boundary
        </span>
        {plotFrames.length ? (
          <span className="specialized-estate-map-plot-count">
            {plotFrames.length} plot outline{plotFrames.length === 1 ? '' : 's'} shown
          </span>
        ) : null}
      </div>
    </div>
  )
}
