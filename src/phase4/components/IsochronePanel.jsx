import { useState } from 'react'
import { Navigation, Bike, Car, Clock, Trash2, Loader } from 'lucide-react'

const MODES = [
  { id: 'walking',  label: 'A pie',   icon: Navigation, color: '#00ff88' },
  { id: 'cycling',  label: 'Bici',    icon: Bike,       color: '#00d4ff' },
  { id: 'driving',  label: 'Coche',   icon: Car,        color: '#ffaa00' },
]

const TIMES = [5, 10, 15, 30]

// Opacidades por anillo (30 min más transparente, 5 min más sólido)
const RING_OPACITY = { 5: 0.45, 10: 0.35, 15: 0.25, 30: 0.15 }

export const DEFAULT_ISOCHRONE_STATE = {
  mode:    'walking',
  times:   [5, 10, 15, 30],
  visible: false,
  origin:  null,   // { lat, lng }
  data:    null,   // GeoJSON de la API
  loading: false,
  error:   null,
}

export default function IsochronePanel({ state, onChange, onClear }) {
  const { mode, times, visible, origin, loading, error } = state

  const setMode  = (m) => onChange({ ...state, mode: m, data: null })
  const toggleTime = (t) => {
    const next = times.includes(t) ? times.filter(x => x !== t) : [...times, t].sort((a,b) => a-b)
    onChange({ ...state, times: next, data: null })
  }

  const currentMode = MODES.find(m => m.id === mode)

  return (
    <div style={{
      background: 'rgba(6,12,20,0.97)',
      border: '1px solid var(--border-bright)',
      borderRadius: 14,
      padding: '14px',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column', gap: 12,
      minWidth: 220,
    }}>
      {/* Título */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
        color: 'var(--accent)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={10} color="var(--accent)" />
          ISOCRONAS
        </div>
        {state.data && (
          <button onClick={onClear} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--red)', padding: 2,
          }} title="Borrar isocronas">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Origen */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: origin ? 'var(--green)' : 'var(--text-muted)',
        background: origin ? 'rgba(0,255,136,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${origin ? 'rgba(0,255,136,0.2)' : 'var(--border)'}`,
        borderRadius: 8, padding: '6px 10px', lineHeight: 1.6,
      }}>
        {origin
          ? `📍 ${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`
          : '🖱️ Click en el mapa para seleccionar origen'
        }
      </div>

      {/* Modo de transporte */}
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1,
          color: 'var(--text-muted)', marginBottom: 6,
        }}>MODO</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {MODES.map(m => {
            const Icon = m.icon
            const active = mode === m.id
            return (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer',
                background: active ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? m.color : 'var(--border)'}`,
                color: active ? m.color : 'var(--text-muted)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, transition: 'all 0.15s',
              }}>
                <Icon size={13} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7 }}>
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tiempos */}
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1,
          color: 'var(--text-muted)', marginBottom: 6,
        }}>MINUTOS</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {TIMES.map(t => {
            const active = times.includes(t)
            return (
              <button key={t} onClick={() => toggleTime(t)} style={{
                flex: 1, padding: '5px 4px', borderRadius: 8, cursor: 'pointer',
                background: active ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: active ? 700 : 400,
                transition: 'all 0.15s',
              }}>
                {t}′
              </button>
            )
          })}
        </div>
      </div>

      {/* Estado / error */}
      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
          animation: 'pulse 1s infinite',
        }}>
          <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
          Calculando isocronas...
        </div>
      )}
      {error && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--red)',
          background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)',
          borderRadius: 6, padding: '6px 8px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Leyenda cuando hay datos */}
      {state.data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1,
            color: 'var(--text-muted)', marginBottom: 2,
          }}>LEYENDA</div>
          {[...times].reverse().map(t => (
            <div key={t} style={{
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 24, height: 10, borderRadius: 3,
                background: currentMode.color,
                opacity: RING_OPACITY[t] * 3,
                border: `1px solid ${currentMode.color}`,
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text-secondary)',
              }}>
                {t} min — {
                  mode === 'walking' ? `~${(t * 80).toLocaleString()} m` :
                  mode === 'cycling' ? `~${(t * 250).toLocaleString()} m` :
                  `~${(t * 600).toLocaleString()} m`
                }
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { RING_OPACITY, MODES }
