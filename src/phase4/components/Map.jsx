import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// ─── Polígonos hardcodeados — límites aproximados de cada ciudad ─────────────
const CITY_POLYGONS = {
  amsterdam_nl: [[
    [4.729, 52.278], [4.763, 52.279], [4.797, 52.268], [4.837, 52.267],
    [4.870, 52.278], [4.916, 52.303], [4.970, 52.314], [5.008, 52.327],
    [5.035, 52.358], [5.052, 52.391], [5.039, 52.420], [5.000, 52.434],
    [4.958, 52.438], [4.906, 52.432], [4.862, 52.418], [4.820, 52.412],
    [4.783, 52.421], [4.751, 52.420], [4.724, 52.406], [4.718, 52.381],
    [4.720, 52.355], [4.727, 52.325], [4.724, 52.300], [4.729, 52.278],
  ]],
  bangkok_th: [[
    [100.331, 13.499], [100.448, 13.493], [100.531, 13.476], [100.608, 13.460],
    [100.680, 13.488], [100.735, 13.524], [100.800, 13.539], [100.860, 13.551],
    [100.921, 13.567], [100.940, 13.610], [100.932, 13.660], [100.906, 13.712],
    [100.882, 13.760], [100.841, 13.810], [100.780, 13.837], [100.718, 13.840],
    [100.650, 13.826], [100.580, 13.800], [100.520, 13.780], [100.463, 13.762],
    [100.415, 13.735], [100.380, 13.698], [100.355, 13.657], [100.336, 13.608],
    [100.328, 13.560], [100.331, 13.499],
  ]],
  bogota_co: [[
    [-74.224, 4.457], [-74.190, 4.450], [-74.150, 4.438], [-74.110, 4.441],
    [-74.072, 4.458], [-74.042, 4.476], [-74.015, 4.500], [-73.998, 4.528],
    [-73.991, 4.560], [-73.995, 4.600], [-74.005, 4.637], [-74.022, 4.668],
    [-74.048, 4.700], [-74.078, 4.726], [-74.110, 4.738], [-74.148, 4.742],
    [-74.186, 4.736], [-74.212, 4.717], [-74.228, 4.690], [-74.232, 4.657],
    [-74.227, 4.622], [-74.224, 4.585], [-74.228, 4.548], [-74.228, 4.510],
    [-74.228, 4.480], [-74.224, 4.457],
  ]],
  dubai_ae: [[
    [54.890, 24.793], [54.960, 24.790], [55.040, 24.800], [55.120, 24.820],
    [55.200, 24.855], [55.285, 24.895], [55.358, 24.935], [55.412, 24.970],
    [55.455, 25.010], [55.480, 25.060], [55.490, 25.120], [55.485, 25.185],
    [55.462, 25.245], [55.422, 25.295], [55.368, 25.335], [55.305, 25.362],
    [55.235, 25.375], [55.162, 25.370], [55.090, 25.348], [55.020, 25.315],
    [54.958, 25.275], [54.910, 25.230], [54.878, 25.180], [54.863, 25.125],
    [54.865, 25.065], [54.878, 25.005], [54.882, 24.950], [54.882, 24.880],
    [54.890, 24.793],
  ]],
  houston_us: [[
    [-95.788, 29.523], [-95.710, 29.519], [-95.628, 29.515], [-95.545, 29.520],
    [-95.462, 29.535], [-95.382, 29.558], [-95.312, 29.588], [-95.252, 29.626],
    [-95.210, 29.672], [-95.188, 29.725], [-95.185, 29.782], [-95.200, 29.840],
    [-95.230, 29.895], [-95.272, 29.942], [-95.325, 29.980], [-95.388, 30.008],
    [-95.458, 30.025], [-95.532, 30.033], [-95.608, 30.030], [-95.682, 30.018],
    [-95.748, 29.998], [-95.803, 29.970], [-95.842, 29.935], [-95.862, 29.895],
    [-95.865, 29.850], [-95.852, 29.805], [-95.825, 29.762], [-95.786, 29.722],
    [-95.752, 29.682], [-95.735, 29.638], [-95.742, 29.592], [-95.765, 29.555],
    [-95.788, 29.523],
  ]],
  madrid_es: [[
    [-3.888, 40.312], [-3.843, 40.309], [-3.796, 40.312], [-3.751, 40.322],
    [-3.710, 40.340], [-3.675, 40.364], [-3.648, 40.394], [-3.631, 40.428],
    [-3.625, 40.464], [-3.629, 40.500], [-3.643, 40.534], [-3.665, 40.562],
    [-3.695, 40.583], [-3.730, 40.596], [-3.768, 40.601], [-3.808, 40.598],
    [-3.845, 40.587], [-3.876, 40.570], [-3.899, 40.546], [-3.912, 40.517],
    [-3.915, 40.485], [-3.908, 40.452], [-3.893, 40.421], [-3.870, 40.395],
    [-3.851, 40.368], [-3.850, 40.340], [-3.862, 40.320], [-3.888, 40.312],
  ]],
  mexico_city_mx: [[
    [-99.366, 19.048], [-99.316, 19.042], [-99.265, 19.048], [-99.215, 19.062],
    [-99.170, 19.082], [-99.133, 19.110], [-99.105, 19.145], [-99.088, 19.185],
    [-99.082, 19.228], [-99.087, 19.272], [-99.100, 19.314], [-99.120, 19.352],
    [-99.148, 19.386], [-99.182, 19.413], [-99.220, 19.432], [-99.260, 19.442],
    [-99.302, 19.444], [-99.343, 19.438], [-99.380, 19.424], [-99.410, 19.404],
    [-99.432, 19.378], [-99.444, 19.349], [-99.446, 19.317], [-99.438, 19.285],
    [-99.422, 19.255], [-99.400, 19.228], [-99.408, 19.195], [-99.428, 19.165],
    [-99.440, 19.132], [-99.438, 19.096], [-99.420, 19.067], [-99.390, 19.050],
    [-99.366, 19.048],
  ]],
  monterrey_mx: [[
    [-100.460, 25.548], [-100.418, 25.542], [-100.375, 25.545], [-100.335, 25.556],
    [-100.300, 25.574], [-100.272, 25.598], [-100.254, 25.628], [-100.248, 25.660],
    [-100.254, 25.692], [-100.270, 25.720], [-100.295, 25.742], [-100.326, 25.756],
    [-100.360, 25.762], [-100.395, 25.760], [-100.428, 25.750], [-100.455, 25.732],
    [-100.472, 25.708], [-100.478, 25.680], [-100.474, 25.650], [-100.460, 25.622],
    [-100.460, 25.590], [-100.466, 25.562], [-100.460, 25.548],
  ]],
  mumbai_in: [[
    [72.776, 18.894], [72.798, 18.892], [72.820, 18.898], [72.842, 18.912],
    [72.862, 18.932], [72.878, 18.958], [72.888, 18.988], [72.894, 19.022],
    [72.896, 19.058], [72.894, 19.095], [72.888, 19.130], [72.878, 19.162],
    [72.864, 19.190], [72.846, 19.212], [72.828, 19.228], [72.908, 19.238],
    [72.940, 19.228], [72.962, 19.208], [72.975, 19.182], [72.980, 19.152],
    [72.978, 19.120], [72.970, 19.088], [72.956, 19.058], [72.938, 19.030],
    [72.918, 19.002], [72.900, 18.972], [72.886, 18.940], [72.874, 18.910],
    [72.862, 18.882], [72.840, 18.866], [72.818, 18.862], [72.796, 18.868],
    [72.780, 18.880], [72.776, 18.894],
  ]],
  nairobi_ke: [[
    [36.651, -1.444], [36.705, -1.448], [36.760, -1.445], [36.815, -1.435],
    [36.868, -1.420], [36.918, -1.400], [36.962, -1.374], [36.998, -1.344],
    [37.025, -1.310], [37.042, -1.273], [37.048, -1.234], [37.044, -1.194],
    [37.030, -1.156], [37.008, -1.122], [36.978, -1.092], [36.942, -1.068],
    [36.902, -1.052], [36.860, -1.045], [36.817, -1.048], [36.775, -1.060],
    [36.736, -1.080], [36.702, -1.106], [36.675, -1.138], [36.658, -1.174],
    [36.649, -1.212], [36.649, -1.252], [36.656, -1.292], [36.668, -1.330],
    [36.672, -1.370], [36.660, -1.408], [36.651, -1.444],
  ]],
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

export default function Map({ selectedCity, onCitySelect, lulcData }) {
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const prevCity     = useRef(null)

  // Inicializar mapa + cargar todos los polígonos al inicio
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

      // Precargar todos los polígonos — ocultos por defecto
      Object.entries(CITY_POLYGONS).forEach(([key, coords]) => {
        map.current.addSource(`poly-${key}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: coords },
            properties: {},
          },
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

  // Mostrar polígono al seleccionar ciudad
  useEffect(() => {
    if (!map.current) return

    const apply = () => {
      // Ocultar ciudad anterior
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

      // Mostrar polígono inmediatamente
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

  // Colorear con LULC cuando llegan datos
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
