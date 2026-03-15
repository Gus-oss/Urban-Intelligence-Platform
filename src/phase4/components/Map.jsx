import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// ─── Pon aquí tu token de Mapbox ────────────────────────────────────
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'TU_TOKEN_AQUI'

export const CITIES = {
  amsterdam_nl:   { name: 'Amsterdam',         country: 'Netherlands',     lat: 52.3676,  lng: 4.9041   },
  bangkok_th:     { name: 'Bangkok',            country: 'Thailand',        lat: 13.7563,  lng: 100.5018 },
  bogota_co:      { name: 'Bogotá',             country: 'Colombia',        lat: 4.7110,   lng: -74.0721 },
  dubai_ae:       { name: 'Dubai',              country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  houston_us:     { name: 'Houston',            country: 'United States',   lat: 29.7604,  lng: -95.3698 },
  madrid_es:      { name: 'Madrid',             country: 'Spain',           lat: 40.4168,  lng: -3.7038  },
  mexico_city_mx: { name: 'Mexico City',        country: 'Mexico',          lat: 19.4326,  lng: -99.1332 },
  monterrey_mx:   { name: 'Monterrey',          country: 'Mexico',          lat: 25.6866,  lng: -100.3161},
  mumbai_in:      { name: 'Mumbai',             country: 'India',           lat: 19.0760,  lng: 72.8777  },
  nairobi_ke:     { name: 'Nairobi',            country: 'Kenya',           lat: -1.2921,  lng: 36.8219  },
}

// Mezcla los colores LULC ponderados por porcentaje
function blendLULCColor(distribucion) {
  const classes = [
    { key: 'Urbano/Construido',   r: 255, g: 107, b: 107 },
    { key: 'Vegetación/Bosque',   r: 81,  g: 207, b: 102 },
    { key: 'Agua',                r: 51,  g: 154, b: 240 },
    { key: 'Suelo desnudo/Árido', r: 255, g: 212, b: 59  },
  ]
  let r = 0, g = 0, b = 0, total = 0
  classes.forEach(cls => {
    const pct = distribucion?.[cls.key]?.porcentaje || 0
    r += cls.r * pct; g += cls.g * pct; b += cls.b * pct
    total += pct
  })
  if (total === 0) return '#1e4060'
  return `rgb(${Math.round(r / total * (total / 100))}, ${Math.round(g / total * (total / 100))}, ${Math.round(b / total * (total / 100))})`
}

// Fetch del polígono desde Nominatim (OSM) 
async function fetchCityPolygon(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?` +
      `city=${encodeURIComponent(city.name)}&` +
      `country=${encodeURIComponent(city.country)}&` +
      `polygon_geojson=1&limit=1&format=json`

    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json()

    if (!data.length) return null
    const geom = data[0].geojson
    if (!geom) return null

    // Normalizar a Feature
    return {
      type: 'Feature',
      geometry: geom,
      properties: {}
    }
  } catch {
    return null
  }
}

export default function Map({ selectedCity, onCitySelect, lulcData }) {
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const polygons     = useRef({})   // cache de polígonos descargados
  const [loading, setLoading] = useState(null)  // ciudad cargando polígono

  // Inicializar mapa
  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [10, 20],
      zoom: 1.8,
      projection: 'globe',
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.current.on('style.load', () => {
      // Estilo oscuro para el globo
      map.current.setFog({
        color: 'rgb(5, 10, 15)',
        'high-color': 'rgb(10, 21, 32)',
        'horizon-blend': 0.02,
        'star-intensity': 0.6,
      })

      // Añadir marcadores de todas las ciudades
      Object.entries(CITIES).forEach(([key, city]) => {
        const el = document.createElement('div')
        el.className = 'city-marker'
        el.style.cssText = `
          width: 12px; height: 12px; border-radius: 50%;
          background: #00ff88; border: 2px solid #050a0f;
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 0 8px #00ff88;
        `
        el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)' })
        el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
        el.addEventListener('click', () => onCitySelect(key))

        new mapboxgl.Marker({ element: el })
          .setLngLat([city.lng, city.lat])
          .setPopup(new mapboxgl.Popup({ offset: 15, closeButton: false }).setHTML(`
            <div style="font-family:'Space Mono',monospace;font-size:11px;
              background:#0a1520;color:#e8f4f8;padding:6px 10px;border-radius:4px;">
              <div style="color:#00d4ff;font-weight:700">${city.name}</div>
              <div style="color:#3a6070;font-size:9px;margin-top:2px">${city.country}</div>
            </div>
          `))
          .addTo(map.current)
      })
    })
  }, [])

  // Cargar polígono cuando se selecciona ciudad
  useEffect(() => {
    if (!selectedCity || !map.current) return
    const city = CITIES[selectedCity]
    if (!city) return

    // Volar a la ciudad
    map.current.flyTo({
      center: [city.lng, city.lat],
      zoom: 9,
      duration: 1800,
      essential: true,
    })

    // Si ya tenemos el polígono en cache, solo actualizar colores
    if (polygons.current[selectedCity]) {
      updatePolygonColor(selectedCity, lulcData?.distribucion)
      return
    }

    // Descargar polígono de OSM
    setLoading(selectedCity)
    fetchCityPolygon(city).then(feature => {
      setLoading(null)
      if (!feature || !map.current) return

      polygons.current[selectedCity] = feature
      const sourceId = `polygon-${selectedCity}`
      const fillId   = `fill-${selectedCity}`
      const lineId   = `line-${selectedCity}`

      // Añadir source y layers si no existen
      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [feature] }
        })

        map.current.addLayer({
          id: fillId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#1e4060',
            'fill-opacity': 0.45,
          }
        })

        map.current.addLayer({
          id: lineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#00d4ff',
            'line-width': 1.5,
            'line-opacity': 0.8,
          }
        })
      }

      updatePolygonColor(selectedCity, lulcData?.distribucion)
    })
  }, [selectedCity])

  // Actualizar color cuando llegan datos LULC
  useEffect(() => {
    if (!selectedCity || !map.current) return
    updatePolygonColor(selectedCity, lulcData?.distribucion)
  }, [lulcData])

  const updatePolygonColor = (cityKey, distribucion) => {
    const fillId = `fill-${cityKey}`
    if (!map.current?.getLayer(fillId)) return

    if (distribucion) {
      const color = blendLULCColor(distribucion)
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

      {/* Indicador de carga de polígono */}
      {loading && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(10,21,32,0.95)', border: '1px solid var(--accent)',
          borderRadius: 6, padding: '8px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)',
          animation: 'pulse 1s infinite',
        }}>
          🛰️ Cargando polígono...
        </div>
      )}
    </div>
  )
}
