import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export function BoundaryMapViewport({ frames }: { frames: L.LatLngTuple[][] }) {
  const map = useMap()

  useEffect(() => {
    const points = frames.flat()
    if (points.length < 2) return
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
  }, [frames, map])

  return null
}
