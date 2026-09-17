import { IconArrowUpRight } from '@tabler/icons-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMemo, useState } from 'react'
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

function centroidOf(boundary: BoundaryPoint[]): { lat: number; lng: number } | null {
  const valid = boundary.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0),
  )
  if (!valid.length) return null
  return {
    lat: valid.reduce((sum, p) => sum + p.lat, 0) / valid.length,
    lng: valid.reduce((sum, p) => sum + p.lng, 0) / valid.length,
  }
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
  estateName?: string | undefined
}

type GoogleMode = 'drawing' | 'place'

export function EstateLocationMap({ estateBoundary, properties }: EstateLocationMapProps) {
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street')
  const [googleMode, setGoogleMode] = useState<GoogleMode>('drawing')
  const [googleCenter, setGoogleCenter] = useState<{ lat: number; lng: number } | null>(null)
  const hasEstateBoundary = isValidBoundary(estateBoundary)
  const estateFrame = hasEstateBoundary ? boundaryPositions(estateBoundary) : null

  const plotFrames = useMemo(() => {
    return properties
      .filter((property) => isValidBoundary(property.boundary ?? []))
      .map((property) => ({
        property,
        positions: boundaryPositions(property.boundary ?? []),
      }))
  }, [properties])

  const estateCenter = useMemo(() => centroidOf(estateBoundary), [estateBoundary])

  if (!estateFrame) return null

  const frames: L.LatLngTuple[][] = [estateFrame, ...plotFrames.map((f) => f.positions)]
  const flatPoints: L.LatLngTuple[] = frames.flat()

  const activeCenter = googleCenter ?? estateCenter
  // Keyless Google embed (no API key), starts in satellite view (t=k).
  const googleEmbed = activeCenter
    ? `https://maps.google.com/maps?q=${activeCenter.lat},${activeCenter.lng}&z=18&t=k&output=embed`
    : null
  const googleDirectionsUrl = estateCenter
    ? `https://www.google.com/maps/dir/?api=1&destination=${estateCenter.lat},${estateCenter.lng}`
    : null

  const openPlace = (center?: { lat: number; lng: number } | null) => {
    if (center) setGoogleCenter(center)
    else if (estateCenter) setGoogleCenter(estateCenter)
    setGoogleMode('place')
  }

  return (
    <div className="specialized-estate-map" data-testid="estate-location-map">
      <div className="specialized-estate-map-actions">
        <div className="specialized-estate-map-basemap">
          <button
            type="button"
            className={googleMode === 'drawing' ? 'is-active' : ''}
            onClick={() => setGoogleMode('drawing')}
          >
            Drawing
          </button>
          <button
            type="button"
            className={googleMode === 'place' ? 'is-active' : ''}
            onClick={() => openPlace()}
          >
            Open in Google Maps
          </button>
          {googleDirectionsUrl ? (
            <a
              href={googleDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="specialized-map-external"
              title="Opens Google Maps directions in a new tab"
            >
              Get Directions
              <IconArrowUpRight size={13} stroke={2.2} />
            </a>
          ) : null}
        </div>
        {googleMode === 'drawing' ? (
          <div className="specialized-estate-map-basemap">
            <button
              type="button"
              className={basemap === 'street' ? 'is-active' : ''}
              onClick={() => setBasemap('street')}
            >
              Street
            </button>
            <button
              type="button"
              className={basemap === 'satellite' ? 'is-active' : ''}
              onClick={() => setBasemap('satellite')}
            >
              Satellite
            </button>
          </div>
        ) : null}
      </div>

      {googleMode !== 'drawing' && googleEmbed ? (
        <iframe
          key={googleEmbed}
          title="Google Maps satellite view"
          src={googleEmbed}
          className="specialized-estate-map-canvas specialized-estate-map-google"
          loading="lazy"
        />
      ) : (
        <MapContainer
          bounds={L.latLngBounds(flatPoints)}
          scrollWheelZoom={false}
          className="specialized-estate-map-canvas"
        >
          {basemap === 'street' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          )}
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
            const center = centroidOf(property.boundary ?? [])
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
                <Tooltip sticky interactive>
                  <div>
                    <strong>{estateBoardLabel(property)}</strong>
                    <br />
                    {property.statusDisplay || property.status.replaceAll('_', ' ')}
                    {center ? (
                      <>
                        <br />
                        <button
                          type="button"
                          className="specialized-map-link"
                          onClick={() => openPlace(center)}
                        >
                          Open in Google Maps
                        </button>
                      </>
                    ) : null}
                  </div>
                </Tooltip>
              </Polygon>
            )
          })}
          <FitToBoundaries frames={frames} />
        </MapContainer>
      )}
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
