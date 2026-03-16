import { useState, useRef, useEffect } from 'react'
import { Search, MapPin, Zap, Layers, X } from 'lucide-react'

const API_BASE       = '/api'
const MAPBOX_TOKEN   = import.meta.env.VITE_MAPBOX_TOKEN

const CLASS_COLORS = [
  [255, 107, 107],
  [81,  207, 102],
  [51,  154, 240],
  [255, 212,  59],
]

const CLASS_LABELS = [
  { name: 'Urbano/Construido',   color: '#ff6b6b', icon: '🏙️' },
  { name: 'Vegetación/Bosque',   color: '#51cf66', icon: '🌿' },
  { name: 'Agua',                color: '#339af0', icon: '💧' },
  { name: 'Suelo desnudo/Árido', color: '#ffd43b', icon: '🏜️' },
]

export default function LocationSearch({ onLocationAnalyzed }) {
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected,    setSelected]    = useState(null)  // {name, lat, lng}
  const [result,      setResult]      = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loadingGeo,  setLoadingGeo]  = useState(false)
  const [error,       setError]       = useState(null)
  const [sizeKm,      setSizeKm]      = useState(10)
  const [showMask,    setShowMask]    = useState(true)
  const [opacity,     setOpacity]     = useState(0.55)
  const canvasRef  = useRef(null)
  const debounceRef = useRef(null)

  // Geocoding con Mapbox
  const geocode = (text) => {
    if (!text || text.length < 3) { setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingGeo(true)
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=es`
        const res  = await fetch(url)
        const data = await res.json()
        setSuggestions(data.features?.map(f => ({
          name: f.place_name,
          lat:  f.center[1],
          lng:  f.center[0],
        })) || [])
      } catch { setSuggestions([]) }
      finally  { setLoadingGeo(false) }
    }, 400)
  }

  const selectSuggestion = (s) => {
    setSelected(s)
    setQuery(s.name)
    setSuggestions([])
    setResult(null)
    setError(null)
  }

  const analyze = async () => {
    if (!selected || loading) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({
        lat:     selected.lat,
        lng:     selected.lng,
        address: selected.name,
        size_km: sizeKm,
      })
      const res = await fetch(`${API_BASE}/analyze-location?${params}`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Error al analizar la ubicación')
        return
      }
      setResult(data)
      if (onLocationAnalyzed) onLocationAnalyzed(data)
    } catch (err) {
      setError(`Error de conexión: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Dibujar máscara en canvas
  useEffect(() => {
    if (!result?.mask_flat || !canvasRef.current) return
    const size    = result.mask_size
    const canvas  = canvasRef.current
    canvas.width  = size
    canvas.height = size
    const ctx     = canvas.getContext('2d')
    const imgData = ctx.createImageData(size, size)
    result.mask_flat.forEach((cls, i) => {
      const [r, g, b] = CLASS_COLORS[cls] || [128, 128, 128]
      imgData.data[i * 4]     = r
      imgData.data[i * 4 + 1] = g
      imgData.data[i * 4 + 2] = b
      imgData.data[i * 4 + 3] = showMask ? Math.round(opacity * 255) : 0
    })
    ctx.putImageData(imgData, 0, 0)
  }, [result, opacity, showMask])

  const reset = () => {
    setQuery(''); setSelected(null); setResult(null)
    setError(null); setSuggestions([])
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: 20, gap: 14, overflowY: 'auto',
      maxWidth: 720, margin: '0 auto', width: '100%',
    }}>

      {/* Título */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
        color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Layers size={10} color="var(--accent)" />
        ANÁLISIS LULC — CUALQUIER UBICACIÓN
      </div>

      {/* Descripción */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        lineHeight: 1.8, background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px',
      }}>
        Busca cualquier ciudad, barrio o dirección del mundo. El sistema
        descargará la imagen Sentinel-2 más reciente y clasificará el
        uso de suelo con el modelo U-Net.
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--bg-card)', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8, padding: '0 14px', transition: 'border-color 0.2s',
        }}>
          <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); geocode(e.target.value); setSelected(null) }}
            placeholder="Escribe una dirección, ciudad o lugar..."
            style={{
              flex: 1, background: 'transparent', border: 'none',
              padding: '12px 0', color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)', fontSize: 13, outline: 'none',
            }}
            onKeyDown={e => { if (e.key === 'Enter' && selected) analyze() }}
          />
          {query && (
            <button onClick={reset} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, flexShrink: 0,
            }}>
              <X size={14} />
            </button>
          )}
          {loadingGeo && (
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite', flexShrink: 0,
            }} />
          )}
        </div>

        {/* Sugerencias */}
        {suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, marginTop: 4, overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {suggestions.map((s, i) => (
              <div key={i} onClick={() => selectSuggestion(s)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <MapPin size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 12,
                  color: 'var(--text-primary)', lineHeight: 1.4,
                }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opciones de análisis */}
      {selected && !result && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
          borderRadius: 8, padding: '12px 14px', display: 'flex',
          alignItems: 'center', gap: 16,
        }}>
          <MapPin size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>
              UBICACIÓN SELECCIONADA
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
              {selected.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
            </div>
          </div>

          {/* Tamaño del área */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: 1 }}>
              ÁREA
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[5, 10, 20].map(km => (
                <button key={km} onClick={() => setSizeKm(km)} style={{
                  background: sizeKm === km ? 'var(--accent-glow)' : 'transparent',
                  border: `1px solid ${sizeKm === km ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: sizeKm === km ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}>
                  {km}km
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--red)',
          background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: 6, padding: '10px 14px', lineHeight: 1.6,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Botón analizar */}
      {selected && !result && (
        <button onClick={analyze} disabled={loading} style={{
          width: '100%', padding: '13px', borderRadius: 8,
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? 'transparent' : 'var(--accent-glow)',
          border: `1px solid ${loading ? 'var(--border)' : 'var(--accent)'}`,
          color: loading ? 'var(--text-muted)' : 'var(--accent)',
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
        }}>
          <Zap size={14} />
          {loading ? 'DESCARGANDO IMAGEN SENTINEL-2...' : 'ANALIZAR CON U-NET'}
        </button>
      )}

      {/* Loading detallado */}
      {loading && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🛰️</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 2 }}>
            <div style={{ color: 'var(--accent)', animation: 'pulse 1s infinite' }}>
              Descargando imagen Sentinel-2...
            </div>
            <div>Área: {sizeKm}×{sizeKm} km · Resolución: 256×256 px</div>
            <div>Esto puede tardar ~30 segundos</div>
          </div>
        </div>
      )}

      {/* ── RESULTADO ── */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">

          {/* Ubicación analizada */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <MapPin size={12} color="var(--accent)" />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                ANÁLISIS COMPLETADO
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>
                {result.address}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                Área: {result.size_km}×{result.size_km} km · {result.lat?.toFixed(4)}, {result.lng?.toFixed(4)}
              </div>
            </div>
          </div>

          {/* Controles de máscara */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <button onClick={() => setShowMask(v => !v)} style={{
              background: showMask ? 'var(--accent-glow)' : 'transparent',
              border: `1px solid ${showMask ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: showMask ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>
              {showMask ? '🎨 MÁSCARA ON' : '🎨 MÁSCARA OFF'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                OPACIDAD
              </span>
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))}
                disabled={!showMask}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', width: 32 }}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
          </div>

          {/* Imagen + máscara */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--text-muted)', marginBottom: 8,
            }}>
              IMAGEN SENTINEL-2 + SEGMENTACIÓN LULC
            </div>
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {result.original_base64 ? (
                <img
                  src={`data:image/png;base64,${result.original_base64}`}
                  alt="Sentinel-2"
                  style={{ width: '100%', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', paddingTop: '100%', background: 'var(--bg-deep)' }} />
              )}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  imageRendering: 'pixelated',
                  mixBlendMode: 'multiply',
                }}
              />
            </div>
            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {CLASS_LABELS.map((cls, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: cls.color }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                    {cls.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribución LULC */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--text-muted)', marginBottom: 10,
            }}>
              DISTRIBUCIÓN LULC
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CLASS_LABELS.map((cls, i) => {
                const pct = result.distribucion?.[cls.name]?.porcentaje || 0
                return (
                  <div key={i}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>{cls.icon}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                          {cls.name}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: cls.color, fontWeight: 700 }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, background: cls.color,
                        boxShadow: `0 0 8px ${cls.color}`, borderRadius: 2,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Nueva búsqueda */}
          <button onClick={reset} style={{
            width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            fontSize: 10, letterSpacing: 1, transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
          >
            🔍 BUSCAR OTRA UBICACIÓN
          </button>
        </div>
      )}

      {/* CSS para spinner */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
