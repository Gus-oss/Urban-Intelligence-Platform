import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// ─── Polígonos de respaldo simplificados (si no hay GeoJSON descargado) ────
const FALLBACK_POLYGONS = {
  amsterdam_nl:   [[[4.729,52.278],[4.870,52.278],[5.052,52.391],[5.000,52.434],[4.862,52.418],[4.718,52.381],[4.729,52.278]]],
  bangkok_th:     [[[100.331,13.499],[100.940,13.610],[100.841,13.810],[100.650,13.826],[100.380,13.698],[100.331,13.499]]],
  bogota_co:      [[[-74.224,4.457],[-74.015,4.500],[-73.991,4.560],[-74.048,4.700],[-74.228,4.690],[-74.228,4.457],[-74.224,4.457]]],
  dubai_ae:       [[[54.890,24.793],[55.490,25.120],[55.305,25.362],[55.090,25.348],[54.863,25.125],[54.890,24.793]]],
  houston_us:     [[[-95.788,29.523],[-95.462,29.535],[-95.210,29.672],[-95.185,29.782],[-95.388,30.008],[-95.865,29.850],[-95.742,29.592],[-95.788,29.523]]],
  madrid_es:      [[[-3.888,40.312],[-3.710,40.340],[-3.625,40.464],[-3.768,40.601],[-3.915,40.485],[-3.851,40.368],[-3.888,40.312]]],
  mexico_city_mx: [[[-99.366,19.048],[-99.133,19.110],[-99.082,19.228],[-99.220,19.432],[-99.446,19.317],[-99.438,19.096],[-99.366,19.048]]],
  monterrey_mx:   [[[-100.460,25.548],[-100.272,25.598],[-100.248,25.660],[-100.326,25.756],[-100.478,25.680],[-100.460,25.548]]],
  mumbai_in:      [[[72.776,18.894],[72.894,19.022],[72.828,19.228],[72.980,19.152],[72.956,19.058],[72.862,18.882],[72.776,18.894]]],
  nairobi_ke:     [[[36.651,-1.444],[36.962,-1.374],[37.048,-1.234],[36.978,-1.092],[36.736,-1.080],[36.649,-1.252],[36.651,-1.444]]],
}

export const CITIES = {
  amsterdam_nl:   { name: 'Amsterdam',       region: 'Europa — Países Bajos',      lat: 52.370, lng: 4.895    },
  bangkok_th:     { name: 'Bangkok',          region: 'Asia — Tailandia',           lat: 13.756, lng: 100.502  },
  bogota_co:      { name: 'Bogotá',           region: 'América del Sur — Colombia', lat: 4.711,  lng: -74.072  },
  dubai_ae:       { name: 'Dubai',            region: 'Asia — Emiratos Á.U.',       lat: 25.204, lng: 55.270   },
  houston_us:     { name: 'Houston',          region: 'América del Norte — EE.UU.', lat: 29.760, lng: -95.369  },
  madrid_es:      { name: 'Madrid',           region: 'Europa — España',            lat: 40.416, lng: -3.703   },
  mexico_city_mx: { name: 'Ciudad de México', region: 'América del Norte — México', lat: 19.432, lng: -99.133  },
  monterrey_mx:   { name: 'Monterrey',        region: 'América del Norte — México', lat: 25.686, lng: -100.316 },
  mumbai_in:      { name: 'Mumbai',           region: 'Asia — India',               lat: 19.076, lng: 72.877   },
  nairobi_ke:     { name: 'Nairobi',          region: 'África — Kenia',             lat: -1.292, lng: 36.821   },
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

// Carga GeoJSON local o usa el polígono de respaldo
async function loadCityGeoJSON(cityKey) {
  try {
    const res = await fetch(`/geojson/${cityKey}.geojson`)
    if (!res.ok) throw new Error('not found')
    const data = await res.json()
    return data
  } catch {
    // Usar polígono simplificado de respaldo
    const coords = FALLBACK_POLYGONS[cityKey]
    if (!coords) return null
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: coords },
      properties: {},
    }
  }
}

export default function Map({ selectedCity, onCitySelect, lulcData, mapTarget, overlayA, overlayB, isochroneState, onMapClick }) {
  const mapContainer  = useRef(null)
  const map           = useRef(null)
  const prevCity      = useRef(null)
  const geoCache      = useRef({})
  const [loadingPoly, setLoadingPoly] = useState(null)

  // Fly to arbitrary coordinates (from location search results or card click)
  useEffect(() => {
    if (!mapTarget || !map.current) return
    const fly = () => map.current.flyTo({
      center: [mapTarget.lng, mapTarget.lat], zoom: 10, duration: 1800,
    })
    if (map.current.isStyleLoaded()) fly()
    else map.current.once('style.load', fly)
  }, [mapTarget?.lat, mapTarget?.lng, mapTarget?.ts])

  // ── Isocronas ────────────────────────────────────────────────────────────
  // Color por modo (borde/línea)
  const MODE_COLORS = {
    'walking':         '#f0f0f0',
    'cycling':         '#ff2d78',
    'driving':         '#b30000',
    'driving-traffic': '#9b00e8',
  }
  // Color por anillo — gradiente rojo→azul como referencia histórica
  const RING_COLORS_TIME = { 5: '#ff3300', 10: '#ffe000', 15: '#00cfff', 30: '#4040ff' }
  const RING_COLORS_DIST = { 1000: '#ff3300', 5000: '#ffe000', 25000: '#00cfff', 100000: '#4040ff' }
  const RING_OPACITY_TIME = { 5: 0.55, 10: 0.42, 15: 0.30, 30: 0.18 }
  const RING_OPACITY_DIST = { 1000: 0.55, 5000: 0.42, 25000: 0.30, 100000: 0.18 }

  // Generar IDs de todas las posibles capas
  const modeIds  = ['walking','cycling','driving','driving-traffic']
  const timeVals = [5, 10, 15, 30]
  const distVals = [1000, 5000, 25000, 100000]
  const ALL_ISO_LAYERS = []
  modeIds.forEach(m => {
    const safe = m.replace('-','_')
    ;[...timeVals, ...distVals].forEach(v => {
      ALL_ISO_LAYERS.push(`iso-fill-${safe}-${v}`, `iso-line-${safe}-${v}`)
    })
  })

  useEffect(() => {
    if (!map.current) return

    const draw = () => {
      // Limpiar todas las capas anteriores
      ALL_ISO_LAYERS.forEach(id => {
        if (map.current.getLayer(id)) map.current.removeLayer(id)
      })
      if (map.current.getSource('isochrone')) map.current.removeSource('isochrone')

      if (!isochroneState?.data) return

      const isTime   = isochroneState.metric !== 'distance'
      const ringColors = isTime ? RING_COLORS_TIME : RING_COLORS_DIST
      const ringOp   = isTime ? RING_OPACITY_TIME : RING_OPACITY_DIST
      const geomType = isochroneState.geomType || 'polygon'
      const values   = isTime
        ? (isochroneState.times || [])
        : (isochroneState.dists || [])
      const activeModes = isochroneState.activeModes || ['walking']

      map.current.addSource('isochrone', { type: 'geojson', data: isochroneState.data })

      // Dibujar de mayor a menor para que los pequeños queden encima
      const sorted = [...values].sort((a, b) => b - a)

      activeModes.forEach(mode => {
        const safe      = mode.replace('-', '_')
        const modeColor = MODE_COLORS[mode] || '#ffffff'

        sorted.forEach(v => {
          const ringColor = ringColors[v] || '#ffffff'
          const opacity   = ringOp[v] || 0.2
          // Filtrar por valor Y modo
          const filter = ['all',
            ['==', ['get', 'contour'], v],
            ['==', ['get', 'mode'],    mode],
          ]

          if (geomType === 'polygon') {
            map.current.addLayer({
              id: `iso-fill-${safe}-${v}`, type: 'fill', source: 'isochrone',
              filter,
              paint: { 'fill-color': ringColor, 'fill-opacity': opacity },
            })
          }

          map.current.addLayer({
            id: `iso-line-${safe}-${v}`, type: 'line', source: 'isochrone',
            filter,
            paint: {
              'line-color':   geomType === 'linestring' ? ringColor : modeColor,
              'line-width':   geomType === 'linestring' ? 2.5 : 1.5,
              'line-opacity': 0.9,
            },
          })
        })
      })
    }

    if (map.current.isStyleLoaded()) draw()
    else map.current.once('style.load', draw)
  }, [isochroneState?.data, isochroneState?.mode, isochroneState?.geomType, isochroneState?.activeModes])

  // Click en el mapa para seleccionar origen de isocrona
  useEffect(() => {
    if (!map.current || !onMapClick) return

    const handleClick = (e) => {
      onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    }

    map.current.on('click', handleClick)
    return () => map.current?.off('click', handleClick)
  }, [onMapClick])

  // Genera PNG de la máscara LULC en un canvas offscreen
  const buildMaskPng = (maskFlat, maskSize) => {
    const CLASS_RGB = [[255,107,107],[81,207,102],[51,154,240],[255,212,59]]
    const canvas    = document.createElement('canvas')
    canvas.width    = maskSize
    canvas.height   = maskSize
    const ctx       = canvas.getContext('2d')
    const img       = ctx.createImageData(maskSize, maskSize)
    maskFlat.forEach((cls, i) => {
      const [r, g, b] = CLASS_RGB[cls] || [128,128,128]
      img.data[i*4]   = r; img.data[i*4+1] = g
      img.data[i*4+2] = b; img.data[i*4+3] = 200  // semitransparente
    })
    ctx.putImageData(img, 0, 0)
    return canvas.toDataURL('image/png')
  }

  // Aplica la máscara LULC sobre el mapa en las coordenadas exactas del bbox
  const applyLulcOverlay = (id, overlay) => {
    if (!map.current?.isStyleLoaded() || !overlay) return
    const sourceId = `lulc-${id}`
    const layerId  = `lulc-layer-${id}`

    const pngUrl = buildMaskPng(overlay.mask_flat, overlay.mask_size || 256)
    const [minX, minY, maxX, maxY] = overlay.bbox

    const coords = [
      [minX, maxY], [maxX, maxY], [maxX, minY], [minX, minY],
    ]

    if (map.current.getSource(sourceId)) {
      // Actualizar sin parpadeo
      map.current.getSource(sourceId).updateImage({ url: pngUrl, coordinates: coords })
    } else {
      map.current.addSource(sourceId, { type: 'image', url: pngUrl, coordinates: coords })
      map.current.addLayer({
        id: layerId, type: 'raster', source: sourceId,
        paint: { 'raster-opacity': 0.65 },
      })
    }
  }

  const prevOverlayA = useRef(null)
  const prevOverlayB = useRef(null)

  const removeOverlay = (id) => {
    if (!map.current?.isStyleLoaded()) return
    const layerId  = `lulc-layer-${id}`
    const sourceId = `lulc-${id}`
    if (map.current.getLayer(layerId))   map.current.removeLayer(layerId)
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)
  }

  useEffect(() => {
    if (!map.current) return
    // Solo aplicar si cambió realmente (comparar por referencia de mask_flat)
    const prev = prevOverlayA.current
    const same = prev && overlayA && prev.mask_flat === overlayA.mask_flat
    if (same) return
    prevOverlayA.current = overlayA || null
    const apply = () => overlayA ? applyLulcOverlay('a', overlayA) : removeOverlay('a')
    if (map.current.isStyleLoaded()) apply()
    else map.current.once('style.load', apply)
  }, [overlayA])

  useEffect(() => {
    if (!map.current) return
    const prev = prevOverlayB.current
    const same = prev && overlayB && prev.mask_flat === overlayB.mask_flat
    if (same) return
    prevOverlayB.current = overlayB || null
    const apply = () => overlayB ? applyLulcOverlay('b', overlayB) : removeOverlay('b')
    if (map.current.isStyleLoaded()) apply()
    else map.current.once('style.load', apply)
  }, [overlayB])

  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',  // ← satélite real
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

      // Precargar todos los GeoJSON al inicio (en paralelo)
      Object.keys(CITIES).forEach(async (key) => {
        const geojson = await loadCityGeoJSON(key)
        if (!geojson) return
        geoCache.current[key] = geojson

        map.current.addSource(`poly-${key}`, {
          type: 'geojson',
          data: geojson,
        })

        map.current.addLayer({
          id: `fill-${key}`, type: 'fill', source: `poly-${key}`,
          paint: { 'fill-color': '#1e4060', 'fill-opacity': 0 },
        })

        map.current.addLayer({
          id: `line-${key}`, type: 'line', source: `poly-${key}`,
          paint: { 'line-color': '#00d4ff', 'line-width': 2, 'line-opacity': 0 },
        })

        map.current.on('click',      `fill-${key}`, () => onCitySelect(key))
        map.current.on('mouseenter', `fill-${key}`, () => { map.current.getCanvas().style.cursor = 'pointer' })
        map.current.on('mouseleave', `fill-${key}`, () => { map.current.getCanvas().style.cursor = '' })
      })
    })
  }, [])

  // Mostrar/ocultar polígono al cambiar ciudad
  useEffect(() => {
    if (!map.current) return

    const apply = () => {
      // Ocultar anterior
      if (prevCity.current && prevCity.current !== selectedCity) {
        const prev = prevCity.current
        if (map.current.getLayer(`fill-${prev}`)) {
          map.current.setPaintProperty(`fill-${prev}`, 'fill-opacity', 0)
          map.current.setPaintProperty(`line-${prev}`, 'line-opacity', 0)
        }
      }

      if (!selectedCity) return
      prevCity.current = selectedCity

      const city = CITIES[selectedCity]
      if (!city) return

      // Mostrar polígono
      if (map.current.getLayer(`fill-${selectedCity}`)) {
        map.current.setPaintProperty(`fill-${selectedCity}`, 'fill-color', '#1e4060')
        map.current.setPaintProperty(`fill-${selectedCity}`, 'fill-opacity', 0.4)
        map.current.setPaintProperty(`line-${selectedCity}`, 'line-opacity', 1)
      }

      map.current.flyTo({ center: [city.lng, city.lat], zoom: 9, duration: 1600 })
    }

    if (map.current.isStyleLoaded()) apply()
    else map.current.once('style.load', apply)
  }, [selectedCity])

  // Colorear con LULC
  useEffect(() => {
    if (!selectedCity || !map.current) return

    const apply = () => {
      if (!map.current.getLayer(`fill-${selectedCity}`)) return
      const color = blendLULCColor(lulcData?.distribucion)
      if (color) {
        map.current.setPaintProperty(`fill-${selectedCity}`, 'fill-color', color)
        map.current.setPaintProperty(`fill-${selectedCity}`, 'fill-opacity', 0.6)
      }
    }

    if (map.current.isStyleLoaded()) apply()
    else map.current.once('style.load', apply)
  }, [lulcData, selectedCity])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
