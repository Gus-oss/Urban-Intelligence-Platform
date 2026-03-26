import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Upload, Clock } from 'lucide-react'
import Map from './components/Map.jsx'
import FloatingChat from './components/FloatingChat.jsx'
import CityCard from './components/CityCard.jsx'
import SearchPanel from './components/SearchPanel.jsx'
import UploadModal from './components/UploadModal.jsx'
import IsochronePanel, { DEFAULT_ISOCHRONE_STATE } from './components/IsochronePanel.jsx'

const API_BASE     = '/api'
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

async function fetchIsochrone(lat, lng, mode, times) {
  const contours = times.join(',')
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/${mode}/${lng},${lat}` +
    `?contours_minutes=${contours}&polygons=true&access_token=${MAPBOX_TOKEN}`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`Isochrone API error: ${res.status}`)
  return await res.json()
}

export default function App() {
  const [health,       setHealth]       = useState(null)
  const [time,         setTime]         = useState(new Date())

  // Ubicaciones analizadas (máx 2 para comparación)
  const [locationA, setLocationA] = useState(null)
  const [locationB, setLocationB] = useState(null)

  // UI state
  const [showSearch,    setShowSearch]    = useState(false)
  const [showCompare,   setShowCompare]   = useState(false)
  const [showUpload,    setShowUpload]    = useState(false)
  const [showIsochrone, setShowIsochrone] = useState(false)

  // Isochrone state
  const [isochroneState, setIsochroneState] = useState(DEFAULT_ISOCHRONE_STATE)

  // Mapa: ciudad activa para el flyTo
  const [mapTarget, setMapTarget] = useState(null)

  // Reloj
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Health check con retry
  useEffect(() => {
    let attempts = 0
    const tryHealth = () => {
      fetch(`${API_BASE}/health`)
        .then(r => r.json())
        .then(d => {
          setHealth(d)
          if (!d.model_loaded && attempts < 20) {
            attempts++; setTimeout(tryHealth, 3000)
          }
        })
        .catch(() => {
          if (attempts < 20) { attempts++; setTimeout(tryHealth, 3000) }
        })
    }
    tryHealth()
  }, [])

  const handleResultA = (data) => {
    setLocationA(data)
    setMapTarget({ lat: data.lat, lng: data.lng })
    setShowSearch(false)
  }

  const handleResultB = (data) => {
    setLocationB(data)
    setMapTarget({ lat: data.lat, lng: data.lng })
    setShowCompare(false)
  }

  // Cuando el usuario hace click en el mapa → calcular isocronas
  const handleMapClick = useCallback(async ({ lat, lng }) => {
    if (!showIsochrone) return
    const next = { ...isochroneState, origin: { lat, lng }, loading: true, error: null, data: null }
    setIsochroneState(next)
    try {
      const geojson = await fetchIsochrone(lat, lng, next.mode, next.times)
      setIsochroneState(s => ({ ...s, loading: false, data: geojson }))
    } catch (err) {
      setIsochroneState(s => ({ ...s, loading: false, error: err.message }))
    }
  }, [showIsochrone, isochroneState.mode, isochroneState.times])

  // Cuando cambia modo/tiempos y hay origen → recalcular
  const handleIsochroneChange = async (newState) => {
    setIsochroneState(newState)
    if (!newState.origin || newState.times.length === 0) return
    setIsochroneState(s => ({ ...s, ...newState, loading: true, error: null }))
    try {
      const geojson = await fetchIsochrone(
        newState.origin.lat, newState.origin.lng,
        newState.mode, newState.times,
      )
      setIsochroneState(s => ({ ...s, loading: false, data: geojson }))
    } catch (err) {
      setIsochroneState(s => ({ ...s, loading: false, error: err.message }))
    }
  }

  const clearIsochrone = () => setIsochroneState(DEFAULT_ISOCHRONE_STATE)

  const STATUS = [
    { label: 'MODELO', ok: health?.model_loaded },
    { label: 'AGENTE', ok: health?.agent_ready  },
    { label: 'API',    ok: !!health             },
  ]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)' }}>

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header style={{
        height: 50, flexShrink: 0,
        background: 'rgba(8,15,24,0.95)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 16,
        backdropFilter: 'blur(12px)',
        position: 'relative', zIndex: 1000,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, fontSize: 14,
            background: 'linear-gradient(135deg, var(--accent), var(--green))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0,212,255,0.3)',
          }}>🛰️</div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 15, letterSpacing: 1.5, color: 'var(--text-primary)',
            }}>
              Urban<span style={{ color: 'var(--accent)' }}>AI</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 7,
              color: 'var(--text-muted)', letterSpacing: 2, marginTop: -1,
            }}>
              LULC PLATFORM
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Status indicators */}
        {STATUS.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: s.ok ? 'var(--green)' : 'var(--red)',
              boxShadow: s.ok ? '0 0 6px var(--green)' : '0 0 6px var(--red)',
            }} />
            <span style={{ color: s.ok ? 'var(--text-secondary)' : 'var(--red)' }}>{s.label}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>

          {/* Buscar */}
          <button
            onClick={() => { setShowSearch(v => !v); setShowCompare(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 8,
              background: showSearch ? 'var(--accent)' : 'var(--accent-glow)',
              border: `1px solid ${showSearch ? 'var(--accent)' : 'rgba(0,212,255,0.3)'}`,
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
              color: showSearch ? 'var(--bg-deep)' : 'var(--accent)',
              fontWeight: showSearch ? 700 : 400,
            }}
          >
            <Search size={12} />
            BUSCAR
          </button>

          {/* Isocronas */}
          <button
            onClick={() => setShowIsochrone(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 8,
              background: showIsochrone ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showIsochrone ? 'rgba(0,255,136,0.5)' : 'var(--border)'}`,
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
              color: showIsochrone ? 'var(--green)' : 'var(--text-muted)',
            }}
            onMouseEnter={e => { if (!showIsochrone) { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)' }}}
            onMouseLeave={e => { if (!showIsochrone) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}}
          >
            <Clock size={12} />
            ISOCRONAS
          </button>

          {/* Upload */}
          <button
            onClick={() => setShowUpload(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Upload size={12} />
            UPLOAD
          </button>
        </div>

        {/* Reloj UTC */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)',
          background: 'var(--accent-glow)', padding: '4px 10px',
          borderRadius: 6, border: '1px solid rgba(0,212,255,0.2)',
          letterSpacing: 1,
        }}>
          {time.toUTCString().slice(17, 25)} UTC
        </div>

      {/* Search panel — fuera del header para evitar clipping */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 3000 }}>
          <SearchPanel
            onResult={handleResultA}
            onClose={() => setShowSearch(false)}
            isCompare={false}
          />
        </div>
      )}

      {/* Compare panel — fuera del header */}
      {showCompare && (
        <div style={{ position: 'fixed', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 3000 }}>
          <SearchPanel
            onResult={handleResultB}
            onClose={() => setShowCompare(false)}
            isCompare={true}
          />
        </div>
      )}
      </header>

      {/* ══════════════════════ MAPA (pantalla completa) ══════════════════════ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Map
          selectedCity={null}
          onCitySelect={() => {}}
          lulcData={locationA}
          mapTarget={mapTarget}
          overlayA={locationA?.bbox ? {
            bbox: locationA.bbox,
            mask_flat: locationA.mask_flat,
            mask_size: locationA.mask_size,
          } : null}
          overlayB={locationB?.bbox ? {
            bbox: locationB.bbox,
            mask_flat: locationB.mask_flat,
            mask_size: locationB.mask_size,
          } : null}
          isochroneState={isochroneState}
          onMapClick={showIsochrone ? handleMapClick : null}
        />

        {/* Cursor hint cuando isocronas activas */}
        {showIsochrone && !isochroneState.origin && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            background: 'rgba(6,12,20,0.9)',
            border: '1px solid var(--green)',
            borderRadius: 10, padding: '10px 18px',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--green)', letterSpacing: 1,
            animation: 'pulse 2s infinite',
          }}>
            🖱️ &nbsp; CLICK EN EL MAPA PARA CALCULAR ISOCRONAS
          </div>
        )}

        {/* Panel de isocronas flotante */}
        {showIsochrone && (
          <div style={{
            position: 'absolute', top: 16, right: 16, zIndex: 500,
          }}>
            <IsochronePanel
              state={isochroneState}
              onChange={handleIsochroneChange}
              onClear={clearIsochrone}
            />
          </div>
        )}

        {/* ── Cards flotantes (bottom left) ── */}
        <div style={{
          position: 'absolute', bottom: 24, left: 24,
          display: 'flex', gap: 12, alignItems: 'flex-end',
          zIndex: 500,
        }}>
          {locationA && (
            <CityCard
              data={locationA}
              label="A"
              onClose={() => { setLocationA(null); setLocationB(null) }}
              onCompare={() => { setShowCompare(true); setShowSearch(false) }}
              showCompare={!locationB}
              onFlyTo={() => setMapTarget({ lat: locationA.lat, lng: locationA.lng, ts: Date.now() })}
            />
          )}
          {locationB && (
            <CityCard
              data={locationB}
              label="B"
              onClose={() => setLocationB(null)}
              showCompare={false}
              onFlyTo={() => setMapTarget({ lat: locationB.lat, lng: locationB.lng, ts: Date.now() })}
            />
          )}
        </div>

        {/* ── Hint cuando no hay ciudad analizada ── */}
        {!locationA && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
            animation: 'fadeIn 1s ease 0.5s both',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'rgba(255,255,255,0.15)', letterSpacing: 2,
              textShadow: '0 0 20px rgba(0,212,255,0.2)',
            }}>
              PRESIONA BUSCAR PARA ANALIZAR CUALQUIER CIUDAD
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════ FLOATING CHAT ══════════════════════ */}
      <FloatingChat
        selectedLocation={locationA ? { city: locationA.address } : null}
      />

      {/* ══════════════════════ UPLOAD MODAL ══════════════════════ */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onResult={(data) => {
            setShowUpload(false)
          }}
        />
      )}
    </div>
  )
}
