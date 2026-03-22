import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, MapPin, X, Zap, SlidersHorizontal } from 'lucide-react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const API_BASE     = '/api'

export default function SearchPanel({ onResult, onClose, isCompare = false }) {
  const [query,       setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected,    setSelected]    = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loadingGeo,  setLoadingGeo]  = useState(false)
  const [sizeKm,      setSizeKm]      = useState(10)
  const [error,       setError]       = useState(null)
  const inputRef    = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const geocode = (text) => {
    if (!text || text.length < 3) { setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoadingGeo(true)
      try {
        const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=es`
        const res  = await fetch(url)
        const data = await res.json()
        setSuggestions(data.features?.map(f => ({
          name: f.place_name,
          lat:  f.center[1],
          lng:  f.center[0],
        })) || [])
      } catch { setSuggestions([]) }
      finally  { setLoadingGeo(false) }
    }, 350)
  }

  const selectSuggestion = (s) => {
    setSelected(s)
    setQuery(s.name)
    setSuggestions([])
    setError(null)
  }

  const analyze = async () => {
    if (!selected || loading) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        lat: selected.lat, lng: selected.lng,
        address: selected.name, size_km: sizeKm,
      })
      const res  = await fetch(`${API_BASE}/analyze-location?${params}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al analizar'); return }
      onResult(data)
      onClose()
    } catch (err) {
      setError(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="slide-down" style={{
      width: 520,
      background: 'rgba(8,15,24,0.98)',
      border: '1px solid var(--border-bright)',
      borderRadius: 14,
      boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,212,255,0.08)',
      backdropFilter: 'blur(16px)',
      overflow: 'visible',
    }}>
      {/* Header del panel */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
          color: isCompare ? 'var(--amber)' : 'var(--accent)',
        }}>
          {isCompare ? '🔁 COMPARAR CON' : '🔍 ANALIZAR UBICACIÓN'}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 3,
        }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Input de búsqueda */}
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 10, padding: '0 14px',
            transition: 'border-color 0.2s',
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); geocode(e.target.value); setSelected(null) }}
              onKeyDown={e => { if (e.key === 'Enter' && selected) analyze() }}
              placeholder="Ciudad, barrio, dirección..."
              style={{
                flex: 1, background: 'transparent', border: 'none',
                padding: '12px 0', color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)', fontSize: 13, outline: 'none',
              }}
            />
            {loadingGeo && (
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite',
              }} />
            )}
            {query && (
              <button onClick={() => { setQuery(''); setSelected(null); setSuggestions([]) }} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 2,
              }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sugerencias dropdown */}
          {suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: 4, background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: 10,
              overflow: 'hidden', zIndex: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => selectSuggestion(s)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <MapPin size={11} color="var(--accent)" />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {s.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opciones de área + botón */}
        {selected && (
          <div className="fade-in" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 8,
              color: 'var(--text-muted)', letterSpacing: 1, whiteSpace: 'nowrap',
            }}>
              ÁREA:
            </div>
            {[5, 10, 20].map(km => (
              <button key={km} onClick={() => setSizeKm(km)} style={{
                background: sizeKm === km ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${sizeKm === km ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: sizeKm === km ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>
                {km}km
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={analyze} disabled={loading} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              cursor: loading ? 'wait' : 'pointer',
              background: loading
                ? 'var(--bg-hover)'
                : isCompare
                  ? 'linear-gradient(135deg, rgba(255,170,0,0.2), rgba(255,170,0,0.1))'
                  : 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.1))',
              border: `1px solid ${loading ? 'var(--border)' : isCompare ? 'rgba(255,170,0,0.5)' : 'rgba(0,212,255,0.5)'}`,
              color: loading ? 'var(--text-muted)' : isCompare ? 'var(--amber)' : 'var(--accent)',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
            }}>
              <Zap size={12} />
              {loading ? 'ANALIZANDO...' : 'ANALIZAR'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{
            textAlign: 'center', padding: '12px 0',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-muted)', animation: 'pulse 1s infinite',
          }}>
            🛰️ &nbsp; Descargando imagen Sentinel-2 · ~30s
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--red)',
            background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  )
}
