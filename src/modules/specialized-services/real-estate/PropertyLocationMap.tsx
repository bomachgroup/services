import { IconArrowUpRight } from '@tabler/icons-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMemo, useState } from 'react'
import { MapContainer, Polygon, TileLayer } from 'react-leaflet'

import { BoundaryMapViewport } from './BoundaryMapViewport'
import { boundaryPositions, centroidOf, isValidBoundary } from './real-estate-map.utils'
import type { BoundaryPoint, PropertyStatus } from './real-estate.types'

const STATUS_COLORS: Record<PropertyStatus, string> = {
  available: '#15803d',
  reserved: '#b45309',
  under_offer: '#6d28d9',
  sold: '#b91c1c',
  hold: '#1d4ed8',
  'not-for-sale': '#475569',
}

type GoogleMode = 'boundary' | 'place'

export function PropertyLocationMap({
  propertyBoundary,
  estateBoundary = [],
  propertyName = 'Property boundary',
  status = 'available',
}: {
  propertyBoundary: BoundaryPoint[]
  estateBoundary?: BoundaryPoint[]
  propertyName?: string
  status?: PropertyStatus
}) {
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street')
  const [googleMode, setGoogleMode] = useState<GoogleMode>('boundary')
  const hasPropertyBoundary = isValidBoundary(propertyBoundary)
  const hasEstateBoundary = isValidBoundary(estateBoundary)

  const propertyFrame = hasPropertyBoundary ? boundaryPositions(propertyBoundary) : null
  const estateFrame = hasEstateBoundary ? boundaryPositions(estateBoundary) : null
  const propertyCenter = useMemo(() => centroidOf(propertyBoundary), [propertyBoundary])
  const frames = useMemo(
    () => (propertyFrame ? (estateFrame ? [estateFrame, propertyFrame] : [propertyFrame]) : []),
    [estateFrame, propertyFrame],
  )

  if (!propertyFrame) return null

  const activeCenter = propertyCenter
  const googleEmbed = activeCenter
    ? `https://maps.google.com/maps?q=${activeCenter.lat},${activeCenter.lng}&z=18&t=k&output=embed`
    : null
  const googleDirectionsUrl = activeCenter
    ? `https://www.google.com/maps/dir/?api=1&destination=${activeCenter.lat},${activeCenter.lng}`
    : null
  const propertyColor = STATUS_COLORS[status] ?? STATUS_COLORS.available

  return (
    <div
      className="specialized-estate-map specialized-property-map"
      data-testid="property-location-map"
    >
      <div className="specialized-estate-map-actions">
        <div className="specialized-estate-map-basemap">
          <button
            type="button"
            className={googleMode === 'boundary' ? 'is-active' : ''}
            aria-pressed={googleMode === 'boundary'}
            onClick={() => setGoogleMode('boundary')}
          >
            Boundary map
          </button>
          <button
            type="button"
            className={googleMode === 'place' ? 'is-active' : ''}
            aria-pressed={googleMode === 'place'}
            onClick={() => setGoogleMode('place')}
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
        {googleMode === 'boundary' ? (
          <div className="specialized-estate-map-basemap">
            <button
              type="button"
              className={basemap === 'street' ? 'is-active' : ''}
              aria-pressed={basemap === 'street'}
              onClick={() => setBasemap('street')}
            >
              Street
            </button>
            <button
              type="button"
              className={basemap === 'satellite' ? 'is-active' : ''}
              aria-pressed={basemap === 'satellite'}
              onClick={() => setBasemap('satellite')}
            >
              Satellite
            </button>
          </div>
        ) : null}
      </div>

      {googleMode === 'place' && googleEmbed ? (
        <iframe
          title={`${propertyName} Google Maps view`}
          src={googleEmbed}
          className="specialized-estate-map-canvas specialized-estate-map-google"
          loading="lazy"
        />
      ) : (
        <MapContainer
          bounds={L.latLngBounds(frames.flat())}
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
              attribution="Tiles &copy; Esri - Source: Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          )}
          {estateFrame ? (
            <Polygon
              positions={estateFrame}
              pathOptions={{
                color: '#1f3d7a',
                weight: 2,
                fillColor: '#1f3d7a',
                fillOpacity: 0.08,
                dashArray: '6 4',
              }}
            />
          ) : null}
          <Polygon
            positions={propertyFrame}
            pathOptions={{
              color: propertyColor,
              weight: 2,
              fillColor: propertyColor,
              fillOpacity: 0.24,
            }}
          />
          <BoundaryMapViewport frames={frames} />
        </MapContainer>
      )}
      <div className="specialized-estate-map-legend">
        {estateFrame ? (
          <span className="specialized-estate-map-legend-boundary">
            <i /> Estate boundary
          </span>
        ) : null}
        <span>
          <i
            className="specialized-property-map-legend-property"
            style={{ backgroundColor: propertyColor }}
          />
          {propertyName}
        </span>
      </div>
    </div>
  )
}
