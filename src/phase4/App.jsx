import { useState, useEffect } from 'react'
import { Activity, Database, Zap } from 'lucide-react'
import Map, { CITIES } from './components/Map.jsx'
import Chat from './components/Chat.jsx'
import LULCChart from './components/LULCChart.jsx'
import ImageUpload from './components/ImageUpload.jsx'
import Rankings from './components/Rankings.jsx'

const API_BASE = '/api'
const CITY_LIST = Object.entries(CITIES).map(([key, val]) => ({ key, ...val }))

export default function App() {
  const [selectedCity, setSelectedCity] = useState(null)
  const [cityStats,    setCityStats]    = useState(null)
  const [lulcData,     setLulcData]     = useState(null)
  const [health,       setHealth]       = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingLulc,  setLoadingLulc]  = useState(false)
  const [activePanel,  setActivePanel]  = useState('map')
  const [time,         setTime]         = useState(new Date())

  // Reloj UTC
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Health check al montar
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  // Stats de ciudad al seleccionar
  useEffect(() => {
    if (!selectedCity) return
    setLoadingStats(true)
    setLulcData(null)
    fetch(`${API_BASE}/stats/${selectedCity}`)
      .then(r => r.json())
      .then(d => { setCityStats(d); setLoadingStats(false) })
      .catch(() => { setCityStats(null); setLoadingStats(false) })
  }, [selectedCity])

  const runClassification = () => {
    if (!selectedCity || loadingLulc) return
    setLoadingLulc(true)
    setLulcData(null)
    fetch(`${API_BASE}/classify/${selectedCity}?max_patches=50`)
      .then(r => r.json())
      .then(d => { setLulcData(d); setLoadingLulc(false) })
      .catch(() => setLoadingLulc(false))
  }

  const handleCitySelect = (key) => {
    setSelectedCity(key)
    setCityStats(null)
    setLulcData(null)
    setActivePanel('map')
  }

  const city = selectedCity ? CITIES[selectedCity] : null

  const TABS = [
    { id: 'map',      label: '🗺  MAPA'     },
    { id: 'chat',     label: '💬  CHAT'     },
    { id: 'upload',   label: '📡  UPLOAD'   },
    { id: 'rankings', label: '🏆  RANKINGS' },
  ]

  // ─── Estilos reutilizables ───────────────────────────────────────
  const panelTitle = (label) => ({
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
    color: 'var(--text-muted)', marginBottom: 10,
    display: 'flex', alignItems: 'center', gap: 6,
    children: label,
  })

  return (
    <div style={{
      height: '100vh', display: 'grid',
      gridTemplateRows: '48px 1fr',
      gridTemplateColumns: '220px 1fr 300px',
      gridTemplateAreas: `"header header header" "sidebar main right"`,
    }}>

      {/* ═══════════════════════════════ HEADER ════════════════════════════════ */}
      <header style={{
        gridArea: 'header',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 4, fontSize: 15,
            background: 'linear-gradient(135deg, var(--accent), var(--green))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🛰️</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
              URBAN INTELLIGENCE
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: 2 }}>
              LULC PLATFORM v1.0
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

        {/* Status indicators */}
        {[
          { label: 'MODELO', ok: health?.model_loaded },
          { label: 'AGENTE', ok: health?.agent_ready  },
          { label: 'RAG',    ok: health?.agent_ready  },
          { label: 'API',    ok: !!health             },
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: s.ok ? 'var(--green)' : 'var(--red)',
              boxShadow:  s.ok ? '0 0 6px var(--green)' : '0 0 6px var(--red)',
            }} />
            <span style={{ color: s.ok ? 'var(--text-secondary)' : 'var(--red)' }}>{s.label}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />

        {/* Métricas + reloj */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1.8 }}>
          <div style={{ color: 'var(--text-secondary)' }}>{health?.cities_available || 10} CIUDADES</div>
          <div>150,932 PATCHES</div>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)',
          background: 'var(--accent-glow)', padding: '4px 10px', borderRadius: 4,
          border: '1px solid rgba(0,212,255,0.2)', letterSpacing: 1,
        }}>
          {time.toUTCString().slice(17, 25)} UTC
        </div>
      </header>

      {/* ═══════════════════════════════ SIDEBAR ═══════════════════════════════ */}
      <aside style={{
        gridArea: 'sidebar',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Label */}
        <div style={{
          padding: '12px 14px 8px',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
          color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Database size={10} color="var(--accent)" />
          CIUDADES — {CITY_LIST.length}
        </div>

        {/* City list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {CITY_LIST.map(c => (
            <div
              key={c.key}
              onClick={() => handleCitySelect(c.key)}
              style={{
                padding: '8px 14px', cursor: 'pointer',
                background: selectedCity === c.key ? 'var(--accent-glow)' : 'transparent',
                borderLeft: `2px solid ${selectedCity === c.key ? 'var(--accent)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (selectedCity !== c.key) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (selectedCity !== c.key) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: selectedCity === c.key ? 'var(--accent)' : 'var(--text-primary)' }}>
                {c.name}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                {c.region}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ═══════════════════════════════ MAIN (tabs) ═══════════════════════════ */}
      <main style={{ gridArea: 'main', position: 'relative', overflow: 'hidden' }}>

        {/* Tab bar */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, display: 'flex', gap: 4,
          background: 'rgba(10,21,32,0.92)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 3, backdropFilter: 'blur(8px)',
        }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActivePanel(tab.id)} style={{
              background: activePanel === tab.id ? 'var(--accent)' : 'transparent',
              border: 'none', borderRadius: 6, padding: '5px 16px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
              color: activePanel === tab.id ? 'var(--bg-deep)' : 'var(--text-muted)',
              fontWeight: activePanel === tab.id ? 700 : 400,
              transition: 'all 0.2s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel: MAPA */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: activePanel === 'map' ? 1 : 0,
          pointerEvents: activePanel === 'map' ? 'all' : 'none',
          transition: 'opacity 0.3s',
        }}>
          <Map selectedCity={selectedCity} onCitySelect={handleCitySelect} lulcData={lulcData} />
        </div>

        {/* Panel: CHAT */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: activePanel === 'chat' ? 1 : 0,
          pointerEvents: activePanel === 'chat' ? 'all' : 'none',
          transition: 'opacity 0.3s',
          background: 'var(--bg-deep)',
        }}>
          <Chat selectedCity={selectedCity} cityName={city?.name} />
        </div>

        {/* Panel: UPLOAD */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: activePanel === 'upload' ? 1 : 0,
          pointerEvents: activePanel === 'upload' ? 'all' : 'none',
          transition: 'opacity 0.3s',
          background: 'var(--bg-deep)',
          overflowY: 'auto',
        }}>
          <ImageUpload />
        </div>

        {/* Panel: RANKINGS */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: activePanel === 'rankings' ? 1 : 0,
          pointerEvents: activePanel === 'rankings' ? 'all' : 'none',
          transition: 'opacity 0.3s',
          background: 'var(--bg-deep)',
          overflowY: 'auto',
        }}>
          <Rankings />
        </div>

        {/* Tooltip ciudad seleccionada sobre el mapa */}
        {selectedCity && activePanel === 'map' && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
            background: 'rgba(10,21,32,0.95)', border: '1px solid var(--border-bright)',
            borderRadius: 8, padding: '10px 14px', backdropFilter: 'blur(8px)',
            fontFamily: 'var(--font-mono)', fontSize: 10, minWidth: 180,
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ color: 'var(--accent)', letterSpacing: 1, marginBottom: 4 }}>CIUDAD SELECCIONADA</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {city?.name}
            </div>
            <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{city?.region}</div>
            {cityStats && (
              <div style={{ marginTop: 6, color: 'var(--green)' }}>
                ✓ {cityStats.patches?.toLocaleString()} patches
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════ RIGHT PANEL ═══════════════════════════ */}
      <aside style={{
        gridArea: 'right',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Ciudad seleccionada — info */}
        {!selectedCity ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10,
            padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32 }}>🌍</div>
            <div style={{ letterSpacing: 1 }}>Selecciona una ciudad<br />del panel izquierdo</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* City header */}
            <div style={{
              padding: '14px 14px 10px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
                color: 'var(--text-muted)', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Activity size={10} color="var(--accent)" />
                ANÁLISIS LULC
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                {city?.name}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                {city?.region}
              </div>

              {/* Stats row */}
              {loadingStats && (
                <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', animation: 'pulse 1s infinite' }}>
                  Cargando stats...
                </div>
              )}
              {cityStats && (
                <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                  {[
                    { label: 'PATCHES', value: cityStats.patches?.toLocaleString() },
                    { label: 'ESTACIONES', value: cityStats.estaciones },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: 1 }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón clasificar */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <button onClick={runClassification} disabled={loadingLulc} style={{
                width: '100%', padding: '8px', borderRadius: 6,
                cursor: loadingLulc ? 'wait' : 'pointer',
                background: loadingLulc ? 'transparent' : 'var(--accent-glow)',
                border: `1px solid ${loadingLulc ? 'var(--border)' : 'var(--accent)'}`,
                color: loadingLulc ? 'var(--text-muted)' : 'var(--accent)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}>
                <Zap size={12} />
                {loadingLulc ? 'CLASIFICANDO...' : 'CLASIFICAR CON U-NET'}
              </button>
              {loadingLulc && (
                <div style={{
                  marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--text-muted)', textAlign: 'center',
                  animation: 'pulse 1.2s infinite',
                }}>
                  Procesando patches · puede tardar ~1 min
                </div>
              )}
            </div>

            {/* Chart LULC */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <LULCChart data={lulcData} loading={loadingLulc} cityName={city?.name} />
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
