import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export const CITIES = {
  amsterdam_nl:   { name: 'Amsterdam',       region: 'Europa — Países Bajos',      lat: 52.3676,  lng: 4.9041,    osmId: 271110  },
  bangkok_th:     { name: 'Bangkok',          region: 'Asia — Tailandia',           lat: 13.7563,  lng: 100.5018,  osmId: 1247067 },
  bogota_co:      { name: 'Bogotá',           region: 'América del Sur — Colombia', lat: 4.7110,   lng: -74.0721,  osmId: 7426387 },
  dubai_ae:       { name: 'Dubai',            region: 'Asia — Emiratos Á.U.',       lat: 25.2048,  lng: 55.2708,   osmId: 3765254 },
  houston_us:     { name: 'Houston',          region: 'América del Norte — EE.UU.', lat: 29.7604,  lng: -95.3698,  osmId: 2688911 },
  madrid_es:      { name: 'Madrid',           region: 'Europa — España',            lat: 40.4168,  lng: -3.7038,   osmId: 5326784 },
  mexico_city_mx: { name: 'Ciudad de México', region: 'América del Norte — México', lat: 19.4326,  lng: -99.1332,  osmId: 6279304 },
  monterrey_mx:   { name: 'Monterrey',        region: 'América del Norte — México', lat: 25.6866,  lng: -100.3161, osmId: 3698341 },
  mumbai_in:      { name: 'Mumbai',           region: 'Asia — India',               lat: 19.0760,  lng: 72.8777,   osmId: 7888990 },
  nairobi_ke:     { name: 'Nairobi',          region: 'África — Kenia',             lat: -1.2921,  lng: 36.8219,   osmId: 1394189 },
}

function blendLULCColor(distribucion) {
  if (!distribucion) return null
  const classes = [
    { key: 'Urbano/Construido',   r: 255, g: 107, b: 107 },
    { key: 'Vegetación/Bosque',   r: 81,  g: 207, b: 102 },
    { key: 'Agua',                r: 51,  g: 154, b: 240 },
    { key: 'Suelo desnudo/Árido', r: 255, g: 212, b: 59  },
  ]
  let r = 0, g = 0, b = 0
  classes.forEach(cls => {
    const pct = (distribucion?.[cls.key]?.porcentaje || 0) / 100
    r += cls.r * pct; g += cls.g * pct; b += cls.b * pct
  })
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

async function fetchPolygonByOsmId(osmId) {
  try {
    const url  = `https://nominatim.openstreetmap.org/lookup?osm_ids=R${osmId}&polygon_geojson=1&format=json`
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json()
    if (!data?.length || !data[0].geojson) return null
    return { type: 'Feature', geometry: data[0].geojson, properties: {} }
  } catch { return null }
}

export default function Map({ selectedCity, onCitySelect, lulcData }) {
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const markersRef   = useRef({})
  const polygons     = useRef({})
  const [loading, setLoading] = useState(null)

  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [10, 20],
      zoom: 1.8,
      projection: 'globe',
    })

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    map.current.on('style.load', () => {
      map.current.setFog({
        color: 'rgb(5, 10, 15)',
        'high-color': 'rgb(10, 21, 32)',
        'horizon-blend': 0.02,
        'star-intensity': 0.5,
      })

      Object.entries(CITIES).forEach(([key, city]) => {
        const el = document.createElement('div')
        el.style.cssText = `
          width: 10px; height: 10px; border-radius: 50%;
          background: #00ff88; border: 2px solid #050a0f;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 0 6px #00ff88;
        `
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.6)' })
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
        el.addEventListener('click',      () => onCitySelect(key))

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([city.lng, city.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(`
              <div style="font-family:'Space Mono',monospace;font-size:11px;
                background:#0a1520;color:#e8f4f8;padding:6px 10px;border-radius:4px;">
                <div style="color:#00d4ff;font-weight:700">${city.name}</div>
                <div style="color:#3a6070;font-size:9px;margin-top:2px">${city.region}</div>
              </div>`)
          )
          .addTo(map.current)

        markersRef.current[key] = { marker, el }
      })
    })
  }, [])

  useEffect(() => {
    if (!selectedCity || !map.current) return
    const city = CITIES[selectedCity]
    if (!city) return

    // Actualizar estilos de marcadores
    Object.entries(markersRef.current).forEach(([key, { el }]) => {
      const sel = key === selectedCity
      el.style.background = sel ? '#00d4ff' : '#00ff88'
      el.style.boxShadow  = sel ? '0 0 10px #00d4ff' : '0 0 6px #00ff88'
      el.style.width      = sel ? '14px' : '10px'
      el.style.height     = sel ? '14px' : '10px'
    })

    map.current.flyTo({ center: [city.lng, city.lat], zoom: 9, duration: 1600 })

    if (polygons.current[selectedCity]) {
      updatePolygonColor(selectedCity, lulcData?.distribucion)
      return
    }

    setLoading(selectedCity)
    fetchPolygonByOsmId(city.osmId).then(feature => {
      setLoading(null)
      if (!feature || !map.current) return
      polygons.current[selectedCity] = feature

      const sourceId = `poly-${selectedCity}`
      const fillId   = `fill-${selectedCity}`
      const lineId   = `line-${selectedCity}`

      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [feature] },
        })
        map.current.addLayer({
          id: fillId, type: 'fill', source: sourceId,
          paint: { 'fill-color': '#1e4060', 'fill-opacity': 0.4 },
        })
        map.current.addLayer({
          id: lineId, type: 'line', source: sourceId,
          paint: { 'line-color': '#00d4ff', 'line-width': 1.5, 'line-opacity': 0.9 },
        })
      }
      updatePolygonColor(selectedCity, lulcData?.distribucion)
    })
  }, [selectedCity])

  useEffect(() => {
    if (!selectedCity) return
    updatePolygonColor(selectedCity, lulcData?.distribucion)
  }, [lulcData])

  const updatePolygonColor = (cityKey, distribucion) => {
    const fillId = `fill-${cityKey}`
    if (!map.current?.getLayer(fillId)) return
    const color = blendLULCColor(distribucion)
    if (color) {
      map.current.setPaintProperty(fillId, 'fill-color', color)
      map.current.setPaintProperty(fillId, 'fill-opacity', 0.55)
    } else {
      map.current.setPaintProperty(fillId, 'fill-color', '#1e4060')
      map.current.setPaintProperty(fillId, 'fill-opacity', 0.35)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {loading && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(10,21,32,0.95)', border: '1px solid var(--accent)',
          borderRadius: 6, padding: '7px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
          animation: 'pulse 1s infinite',
        }}>
          🛰️ Cargando polígono...
        </div>
      )}
    </div>
  )
}
