import { Navigation, Bike, Car, Clock, Trash2, Loader, CheckSquare } from 'lucide-react'

// ── Colores únicos visibles sobre LULC ───────────────────────────────────────
// No usar: naranja, verde, azul, amarillo (colores del modelo LULC)
// Paleta elegida: blanco, magenta, rojo carmesí, violeta eléctrico
export const MODES = [
  { id: 'walking',         label: 'A pie',   icon: Navigation, color: '#f0f0f0'  }, // blanco suave
  { id: 'cycling',         label: 'Bici',    icon: Bike,       color: '#ff2d78'  }, // rosa-rojo
  { id: 'driving',         label: 'Coche',   icon: Car,        color: '#b30000'  }, // rojo carmesí oscuro
  { id: 'driving-traffic', label: 'Tráfico', icon: Car,        color: '#9b00e8'  }, // violeta eléctrico
]

// Colores por anillo (de mayor a menor tiempo = más transparente a más sólido)
// Simula el gradiente de la imagen de referencia
export const RING_COLORS_BY_TIME = {
  30: '#4040ff',   // azul lejano (30 min = más lejos)
  15: '#00cfff',   // cyan medio
  10: '#ffe000',   // amarillo cercano
  5:  '#ff3300',   // rojo = muy cerca
}
export const RING_COLORS_BY_DIST = {
  100000: '#4040ff',
  25000:  '#00cfff',
  5000:   '#ffe000',
  1000:   '#ff3300',
}

export const RING_OPACITY_TIME = { 5: 0.55, 10: 0.42, 15: 0.30, 30: 0.18 }
export const RING_OPACITY_DIST = { 1000: 0.55, 5000: 0.42, 25000: 0.30, 100000: 0.18 }

const TIMES_LIST = [5, 10, 15, 30]
const DISTS_LIST = [1000, 5000, 25000, 100000]
const DIST_LABELS = { 1000: '1km', 5000: '5km', 25000: '25km', 100000: '100km' }

// driving-traffic no soporta contours_meters en la API de Mapbox
const MODES_SUPPORTING_DISTANCE = ['walking', 'cycling', 'driving']

export const DEFAULT_ISOCHRONE_STATE = {
  activeModes: ['walking'],  // array — permite múltiples modos simultáneos
  metric:      'time',       // 'time' | 'distance'
  geomType:    'polygon',    // 'polygon' | 'linestring'
  times:       [5, 10, 15, 30],
  dists:       [1000, 5000, 25000, 100000],
  origin:      null,
  data:        null,
  loading:     false,
  error:       null,
}

export default function IsochronePanel({ state, onChange, onClear }) {
  const { activeModes, metric, geomType, times, dists, origin, loading, error } = state

  const isTime      = metric === 'time'
  const values      = isTime ? times : dists
  const allValues   = isTime ? TIMES_LIST : DISTS_LIST
  const allSelected = allValues.every(v => values.includes(v))

  const toggleMode = (modeId) => {
    const next = activeModes.includes(modeId)
      ? activeModes.filter(m => m !== modeId)
      : [...activeModes, modeId]
    if (next.length === 0) return // al menos 1 modo
    // Si metric=distance y driving-traffic está seleccionado, quitarlo
    const filtered = metric === 'distance'
      ? next.filter(m => MODES_SUPPORTING_DISTANCE.includes(m))
      : next
    onChange({ ...state, activeModes: filtered.length > 0 ? filtered : next, data: null })
  }

  const setMetric = (m) => {
    // Al cambiar a distancia, quitar driving-traffic si estaba activo
    let newModes = activeModes
    if (m === 'distance') {
      newModes = activeModes.filter(id => MODES_SUPPORTING_DISTANCE.includes(id))
      if (newModes.length === 0) newModes = ['walking']
    }
    onChange({ ...state, metric: m, activeModes: newModes, data: null })
  }

  const setGeomType = (g) => onChange({ ...state, geomType: g, data: null })

  const toggleValue = (v) => {
    const key  = isTime ? 'times' : 'dists'
    const next = values.includes(v)
      ? values.filter(x => x !== v)
      : [...values, v].sort((a, b) => a - b)
    onChange({ ...state, [key]: next, data: null })
  }

  const toggleAll = () => {
    const key  = isTime ? 'times' : 'dists'
    onChange({ ...state, [key]: allSelected ? [] : [...allValues], data: null })
  }

  const ringColors = isTime ? RING_COLORS_BY_TIME : RING_COLORS_BY_DIST

  return (
    <div style={{
      background: 'rgba(6,12,20,0.97)',
      border: '1px solid rgba(0,212,255,0.3)',
      borderRadius: 14, padding: '14px',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column', gap: 12,
      minWidth: 248,
    }}>

      {/* Header */}
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
          }} title="Borrar">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Origen */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: origin ? 'var(--accent)' : 'var(--text-muted)',
        background: origin ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${origin ? 'rgba(0,212,255,0.25)' : 'var(--border)'}`,
        borderRadius: 8, padding: '6px 10px', lineHeight: 1.6,
      }}>
        {origin
          ? `📍 ${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`
          : '🖱️ Click en el mapa para seleccionar origen'
        }
      </div>

      {/* ── Modos (múltiple selección) ── */}
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1,
          color: 'var(--text-muted)', marginBottom: 6,
        }}>
          MODO <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(selección múltiple)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {MODES.map(m => {
            const Icon    = m.icon
            const active  = activeModes.includes(m.id)
            const disabled = metric === 'distance' && !MODES_SUPPORTING_DISTANCE.includes(m.id)
            return (
              <button key={m.id} onClick={() => !disabled && toggleMode(m.id)} style={{
                padding: '6px 4px', borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? `${m.color}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? m.color : disabled ? 'rgba(255,255,255,0.05)' : 'var(--border)'}`,
                color: active ? m.color : disabled ? 'rgba(255,255,255,0.2)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.15s', opacity: disabled ? 0.4 : 1,
              }}>
                <Icon size={11} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>
                  {m.label}
                </span>
                {/* Dot indicador de color */}
                {active && (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: m.color, flexShrink: 0,
                    boxShadow: `0 0 4px ${m.color}`,
                  }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Métrica ── */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
          MÉTRICA
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[{ id: 'time', label: 'Minutos' }, { id: 'distance', label: 'Metros' }].map(opt => (
            <button key={opt.id} onClick={() => setMetric(opt.id)} style={{
              flex: 1, padding: '5px', borderRadius: 8, cursor: 'pointer',
              background: metric === opt.id ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${metric === opt.id ? 'var(--accent)' : 'var(--border)'}`,
              color: metric === opt.id ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              fontWeight: metric === opt.id ? 700 : 400, transition: 'all 0.15s',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
        {metric === 'distance' && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)',
            marginTop: 5, padding: '4px 8px',
            background: 'rgba(255,170,0,0.07)', border: '1px solid rgba(255,170,0,0.2)',
            borderRadius: 6,
          }}>
            ⚠️ Tráfico no disponible en modo metros
          </div>
        )}
      </div>

      {/* ── Geometría ── */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 6 }}>
          GEOMETRÍA
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[{ id: 'polygon', label: 'Polígonos' }, { id: 'linestring', label: 'Líneas' }].map(opt => (
            <button key={opt.id} onClick={() => setGeomType(opt.id)} style={{
              flex: 1, padding: '5px', borderRadius: 8, cursor: 'pointer',
              background: geomType === opt.id ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${geomType === opt.id ? 'var(--accent)' : 'var(--border)'}`,
              color: geomType === opt.id ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              fontWeight: geomType === opt.id ? 700 : 400, transition: 'all 0.15s',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Valores ── */}
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1,
          color: 'var(--text-muted)', marginBottom: 6,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{isTime ? 'MINUTOS' : 'METROS'}</span>
          <button onClick={toggleAll} style={{
            background: allSelected ? 'var(--accent-glow)' : 'transparent',
            border: `1px solid ${allSelected ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 5, padding: '1px 7px', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 7,
            color: allSelected ? 'var(--accent)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s',
          }}>
            <CheckSquare size={9} />
            {allSelected ? 'QUITAR' : 'TODOS'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {allValues.map(v => {
            const active = values.includes(v)
            const label  = isTime ? `${v}′` : DIST_LABELS[v]
            const color  = ringColors[v]
            return (
              <button key={v} onClick={() => toggleValue(v)} style={{
                flex: 1, padding: '5px 2px', borderRadius: 8, cursor: 'pointer',
                background: active ? `${color}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? color : 'var(--border)'}`,
                color: active ? color : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 8,
                fontWeight: active ? 700 : 400, transition: 'all 0.15s',
              }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)',
          animation: 'pulse 1s infinite',
        }}>
          <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
          Calculando {activeModes.length} modo{activeModes.length > 1 ? 's' : ''}...
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

      {/* Leyenda */}
      {state.data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 2 }}>
            LEYENDA
          </div>
          {/* Por modo */}
          {activeModes.map(mId => {
            const mInfo = MODES.find(m => m.id === mId)
            return (
              <div key={mId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: mInfo?.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: mInfo?.color }}>
                  {mInfo?.label}
                </span>
              </div>
            )
          })}
          {/* Por anillo */}
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            {[...values].sort((a,b) => b-a).map(v => (
              <div key={v} style={{
                flex: 1, height: 8, borderRadius: 3,
                background: ringColors[v] || 'var(--border)',
                opacity: 0.8,
              }} title={isTime ? `${v} min` : DIST_LABELS[v]} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[...values].sort((a,b) => b-a).map(v => (
              <div key={v} style={{
                flex: 1, textAlign: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 7,
                color: ringColors[v] || 'var(--text-muted)',
              }}>
                {isTime ? `${v}′` : DIST_LABELS[v]}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
