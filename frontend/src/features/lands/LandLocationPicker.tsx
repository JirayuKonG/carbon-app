import { useEffect, useRef } from 'react'
import L, { type DragEndEvent, type LatLngBoundsExpression, type LatLngTuple, type LeafletMouseEvent } from 'leaflet'
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png?url'
import markerIcon from 'leaflet/dist/images/marker-icon.png?url'
import markerShadow from 'leaflet/dist/images/marker-shadow.png?url'

const THAILAND_CENTER: LatLngTuple = [13.7563, 100.5018]

const defaultMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = defaultMarkerIcon

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

function MapViewController({
  center,
  zoom,
  markerPosition,
  referencePoints,
  scopeKey,
}: {
  center: LatLngTuple
  zoom: number
  markerPosition: LatLngTuple | null
  referencePoints: LatLngTuple[]
  scopeKey: string
}) {
  const map = useMap()
  const lastScopeKeyRef = useRef<string>('')
  const lastMarkerKeyRef = useRef<string>('')

  useEffect(() => {
    const markerKey = markerPosition ? `${markerPosition[0].toFixed(8)}:${markerPosition[1].toFixed(8)}` : ''
    const scopeChanged = lastScopeKeyRef.current !== scopeKey
    const markerChanged = lastMarkerKeyRef.current !== markerKey

    if (scopeChanged) {
      lastScopeKeyRef.current = scopeKey

      if (referencePoints.length > 1) {
        map.fitBounds(referencePoints as LatLngBoundsExpression, { padding: [24, 24], animate: false })
        return
      }

      if (referencePoints.length === 1) {
        map.setView(referencePoints[0], 13, { animate: false })
        return
      }
    }

    if (markerPosition && markerChanged) {
      lastMarkerKeyRef.current = markerKey
      map.setView(markerPosition, 16, { animate: false })
      return
    }

    map.setView(center, zoom, { animate: false })
  }, [center, map, markerPosition, referencePoints, scopeKey, zoom])

  return null
}

export function LandLocationPicker({
  latitude,
  longitude,
  referencePoints = [],
  scopeKey,
  onChange,
}: {
  latitude: number | null
  longitude: number | null
  referencePoints?: LatLngTuple[]
  scopeKey: string
  onChange: (lat: number, lng: number) => void
}) {
  const hasMarker = latitude != null && longitude != null
  const markerPosition = hasMarker ? [latitude, longitude] as LatLngTuple : null
  const center = markerPosition ?? THAILAND_CENTER
  const zoom = markerPosition ? 15 : 6

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-[320px] w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={onChange} />
        <MapViewController
          center={center}
          zoom={zoom}
          markerPosition={markerPosition}
          referencePoints={referencePoints}
          scopeKey={scopeKey}
        />
        {referencePoints.map((point, index) => (
          <CircleMarker
            key={`${point[0]}-${point[1]}-${index}`}
            center={point}
            radius={4}
            pathOptions={{
              color: '#2563eb',
              weight: 1,
              fillColor: '#60a5fa',
              fillOpacity: 0.45,
            }}
          />
        ))}
        {markerPosition && (
          <Marker
            draggable
            position={markerPosition}
            eventHandlers={{
              dragend(event: DragEndEvent) {
                const marker = event.target as L.Marker
                const nextPosition = marker.getLatLng()
                onChange(nextPosition.lat, nextPosition.lng)
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}
