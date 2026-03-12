import { useEffect, useRef } from 'react'
import L from 'leaflet'

export const CITIES = {
  amsterdam_nl:   { name: 'Amsterdam',    region: 'Europa — Países Bajos', lat: 52.3676, lng: 4.9041 },
  bangkok_th:     { name: 'Bangkok',      region: 'Asia — Tailandia',      lat: 13.7563, lng: 100.5018 },
  bogota_co:      { name: 'Bogotá',       region: 'América del Sur — CO',  lat: 4.7110,  lng: -74.0721 },
  dubai_ae:       { name: 'Dubai',        region: 'Asia — Emiratos Á.U.',  lat: 25.2048, lng: 55.2708 },
  houston_us:     { name: 'Houston',      region: 'América del Norte — US',lat: 29.7604, lng: -95.3698 },
  madrid_es:      { name: 'Madrid',       region: 'Europa — España',       lat: 40.4168, lng: -3.7038 },
  mexico_city_mx: { name: 'Ciudad de México', region: 'América del Norte — MX', lat: 19.4326, lng: -99.1332 },
  monterrey_mx:   { name: 'Monterrey',    region: 'América del Norte — MX',lat: 25.6866, lng: -100.3161 },
  mumbai_in:      { name: 'Mumbai',       region: 'Asia — India',          lat: 19.0760, lng: 72.8777 },
  nairobi_ke:     { name: 'Nairobi',      region: 'África — Kenia',        lat: -1.2921, lng: 36.8219 },
}

const createMarker = (selected) => {
  const color = selected ? '#00d4ff' : '#00ff88'
  const size  = selected ? 18 : 12
  const pulse = selected ? `
    <circle cx="9" cy="9" r="9" fill="${color}" opacity="0.15">
      <animate attributeName="r" values="9;16;9" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite"/>
    </circle>` : ''

  return L.divIcon({
    className: '',
    html: `<svg width="${selected ? 36 : 24}" height="${selected ? 36 : 24}" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      ${pulse}
      <circle cx="9" cy="9" r="${size / 3}" fill="${color}" opacity="0.9"/>
      <circle cx="9" cy="9" r="${size / 6}" fill="white" opacity="0.9"/>
    </svg>`,
    iconSize:   [selected ? 36 : 24, selected ? 36 : 24],
    iconAnchor: [selected ? 18 : 12, selected ? 18 : 12],
  })
}

export default function Map({ selectedCity, onCitySelect }) {
  const mapRef      = useRef(null)
  const markersRef  = useRef({})
  const instanceRef = useRef(null)

  useEffect(() => {
    if (instanceRef.current) return
    const map = L.map(mapRef.current, {
      center: [20, 10], zoom: 2,
      zoomControl: true, attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)

    Object.entries(CITIES).forEach(([key, city]) => {
      const marker = L.marker([city.lat, city.lng], { icon: createMarker(false) })
        .addTo(map)
        .on('click', () => onCitySelect(key))

      marker.bindTooltip(`
        <div style="font-family:'Space Mono',monospace;font-size:10px;background:#0a1520;
          border:1px solid #1e4060;border-radius:4px;padding:6px 10px;color:#e8f4f8;white-space:nowrap;">
          <div style="color:#00d4ff;letter-spacing:1px;margin-bottom:2px">${city.name}</div>
          <div style="color:#3a6070;font-size:9px">${city.region}</div>
        </div>`, {
        permanent: false, sticky: true,
        className: 'custom-tooltip', offset: [12, 0],
      })
      markersRef.current[key] = marker
    })

    instanceRef.current = map
  }, [])

  // Actualizar marcadores al cambiar selección
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([key, marker]) => {
      marker.setIcon(createMarker(key === selectedCity))
    })
    if (selectedCity && instanceRef.current) {
      const city = CITIES[selectedCity]
      if (city) instanceRef.current.flyTo([city.lat, city.lng], 5, { duration: 1.2 })
    }
  }, [selectedCity])

  return (
    <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
  )
}
