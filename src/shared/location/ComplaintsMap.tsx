import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { latLngBounds } from 'leaflet'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export type MapPoint = { id: string; latitude: number; longitude: number; title: string; subtitle: string; color: string; href: string }

function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].latitude, points[0].longitude], 14)
    else if (points.length > 1) map.fitBounds(latLngBounds(points.map((point) => [point.latitude, point.longitude])), { padding: [40, 40], maxZoom: 15 })
  }, [map, points])
  return null
}

/** Many complaints on one map. Popups are React elements, never HTML strings. */
export default function ComplaintsMap({ points }: { points: MapPoint[] }) {
  const [tileError, setTileError] = useState(false)
  return <div role="region" aria-label="Map of complaints">
    <MapContainer center={[6.15, 80.7]} zoom={9} scrollWheelZoom className="map-board">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' eventHandlers={{ tileerror() { setTileError(true) } }} />
      <FitToPoints points={points} />
      {points.map((point) => <CircleMarker key={point.id} center={[point.latitude, point.longitude]} radius={10} pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: point.color, fillOpacity: 0.95 }}>
        <Popup><div className="map-popup"><strong>{point.title}</strong><p>{point.subtitle}</p><Link to={point.href}>Open complaint →</Link></div></Popup>
      </CircleMarker>)}
    </MapContainer>
    {tileError && <p className="map-fallback" role="status">Map tiles could not load. Use the department queue instead.</p>}
  </div>
}
