import { useEffect, useRef, useState } from 'react'
import { Icon } from 'leaflet'
import type { Marker as LeafletMarker } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerRetina from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import type { Point } from './coordinates'

const icon = new Icon({ iconUrl: markerIcon, iconRetinaUrl: markerRetina, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41], shadowSize: [41, 41] })
function MapEvents({ onChange }: { onChange: (point: Point) => void }) {
  useMapEvents({ click(event) { const position = event.latlng.wrap(); onChange([position.lat, position.lng]) } })
  return null
}
function SelectedPoint({ point, onChange }: { point: Point; onChange?: (point: Point) => void }) {
  const map = useMap()
  const marker = useRef<LeafletMarker | null>(null)
  useEffect(() => { if (!map.getBounds().contains(point)) map.panTo(point) }, [map, point])
  return <Marker ref={marker} icon={icon} position={point} draggable={!!onChange} eventHandlers={{ dragend() { const position = marker.current?.getLatLng().wrap(); if (position && onChange) onChange([position.lat, position.lng]) } }} />
}
export default function LocationMap({ point, onChange }: { point: Point | null; onChange?: (point: Point) => void }) {
  const [tileError, setTileError] = useState(false)
  return <div className="location-map-wrap" role="region" aria-label="Location map">
    <MapContainer center={point ?? [7.8731, 80.7718]} zoom={point ? 14 : 7} scrollWheelZoom={false} className="location-map">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' eventHandlers={{ tileerror() { setTileError(true) } }} />
      {onChange && <MapEvents onChange={onChange} />}{point && <SelectedPoint point={point} onChange={onChange} />}
    </MapContainer>
    {tileError && <p className="map-fallback" role="status">Map tiles could not load. You can still use the coordinates and location description.</p>}
  </div>
}
