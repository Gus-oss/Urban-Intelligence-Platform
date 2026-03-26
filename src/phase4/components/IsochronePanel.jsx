import { Navigation, Bike, Car, TruckIcon, Clock, Trash2, Loader, CheckSquare } from 'lucide-react'

// ── Colores visibles sobre capa LULC ────────────────────────────────────────
// Evitar verde (vegetación), rojo (urbano), azul (agua), amarillo (árido)
// Usamos blanco, magenta, naranja neón, violeta
export const MODES = [
  { id: 'walking',          label: 'A pie',       icon: Navigation, color: '#ffffff'  },
  { id: 'cycling',          label: 'Bici',         icon: Bike,       color: '#ff00ff'  },
  { id: 'driving',          label: 'Coche',        icon: Car,        color: '#ff6600'  },
  { id: 'driving-traffic',  label: 'Tráfico',      icon: Car,        color: '#cc44ff'  },
]

export const RING_OPACITY_TIME  = { 5: 0.50, 10: 0.38, 15: 0.26, 30: 0.16 }
export const RING_OPACITY_DIST  = { 1000: 0.50, 5000: 0.38, 25000: 0.26, 100000: 0.16 }

const TIMES_LIST = [5, 10, 15, 30]
const DISTS_LIST = [1000, 5000, 25000, 100000]
const DIST_LABELS = { 1000: '1km', 5000: '5km', 25000: '25km', 100000: '100km' }

export const DEFAULT_ISOCHRONE_STATE = {
  mode:     'walking',
  metric:   'time',       // 'time' | 'distance'
  geomType: 'polygon',    // 'polygon' | 'linestring'
  times:    [5, 10, 15, 30],
  dists:    [1000, 5000, 25000, 100000],
  origin:   null,
  data:     null,
  loading:  false,
  error:    null,
}

export default function IsochronePanel({ state, onChange, onClear }) {
  const { mode, metric, geomType, times, dists, origin, loading, error } = state

  const currentMode  = MODES.find(m => m.id === mode)
  const isTime       = metric === 'time'
  const values       = isTime ? times : dists
  const allValues    = isTime ? TIMES_LIST : DISTS_LIST
  const allSelected  = allValues.every(v => values.includes(v))

  const setMode     = (m)  => onChange({ ...state, mode: m,     data: null })
  const setMetric   = (m)  => onChange({ ...state, metric: m,   data: null })
  const setGeomType = (g)  => onChange({ ...state, geomType: g, data: null })

  const toggleValue = (v) => {
    const key  = isTime ? 'times' : 'dists'
    const next = values.includes(v)
      ? values.filter(x => x !== v)
      : [...values, v].sort((a, b) => a - b)
    onChange({ ...state, [key]: next, data: null })
  }

  const toggleAll = () => {
    const key  = isTime ? 'times' : 'dists'
    const next = allSelected ? [] : [...allValues]
    onChange({ ...state, [key]: next, data: null })
  }

  const ringOpacity = isTime ? RING_OPACITY_TIME : RING_OPACITY_DIST

  return (
    <div style={{
      background: 'rgba(6,12,20,0.97)',
      border: '1px solid var(--border-bright)',
      borderRadius: 14, padding: '14px',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column', gap: 12,
      minWidth: 240,
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
          }} title="Borrar isocronas">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Origen */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: origin ? '#00ff88' : 'var(--text-muted)',
        background: origin ? 'rgba(0,255,136,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${origin ? 'rgba(0,255,136,0.2)' : 'var(--border)'}`,
        borderRadius: 8, padding: '6px 10px', lineHeight: 1.6,
      }}>
        {origin
          ? `📍 ${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`
          : '🖱️ Click en el mapa para seleccionar origen'
        }
      </div>

      {/* ── Modo de transporte (4 opciones) ── */}
      <div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:8, letterSpacing:1, color:'var(--text-muted)', marginBottom:6 }}>
          MODO
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {MODES.map(m => {
            const Icon   = m.icon
            const active = mode === m.id
            return (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                padding:'6px 4px', borderRadius:8, cursor:'pointer',
                background: active ? `${m.color}22` : 'rgba(255,255,255,0.03)',
                border:`1px solid ${active ? m.color : 'var(--border)'}`,
                color: active ? m.color : 'var(--text-muted)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                transition:'all 0.15s',
              }}>
                <Icon size={11}/>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:8 }}>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Métrica: tiempo / distancia ── */}
      <div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:8, letterSpacing:1, color:'var(--text-muted)', marginBottom:6 }}>
          MÉTRICA
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {[{id:'time', label:'Minutos'}, {id:'distance', label:'Metros'}].map(opt => (
            <button key={opt.id} onClick={() => setMetric(opt.id)} style={{
              flex:1, padding:'5px', borderRadius:8, cursor:'pointer',
              background: metric === opt.id ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
              border:`1px solid ${metric === opt.id ? 'var(--accent)' : 'var(--border)'}`,
              color: metric === opt.id ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily:'var(--font-mono)', fontSize:9,
              fontWeight: metric === opt.id ? 700 : 400,
              transition:'all 0.15s',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tipo de geometría: polígono / línea ── */}
      <div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:8, letterSpacing:1, color:'var(--text-muted)', marginBottom:6 }}>
          GEOMETRÍA
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {[{id:'polygon', label:'Polígono'}, {id:'linestring', label:'Líneas'}].map(opt => (
            <button key={opt.id} onClick={() => setGeomType(opt.id)} style={{
              flex:1, padding:'5px', borderRadius:8, cursor:'pointer',
              background: geomType === opt.id ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
              border:`1px solid ${geomType === opt.id ? 'var(--accent)' : 'var(--border)'}`,
              color: geomType === opt.id ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily:'var(--font-mono)', fontSize:9,
              fontWeight: geomType === opt.id ? 700 : 400,
              transition:'all 0.15s',
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Valores (minutos o metros) ── */}
      <div>
        <div style={{
          fontFamily:'var(--font-mono)', fontSize:8, letterSpacing:1,
          color:'var(--text-muted)', marginBottom:6,
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <span>{isTime ? 'MINUTOS' : 'METROS'}</span>
          {/* Botón seleccionar todos */}
          <button onClick={toggleAll} style={{
            background: allSelected ? 'rgba(0,212,255,0.1)' : 'transparent',
            border:`1px solid ${allSelected ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius:5, padding:'1px 7px', cursor:'pointer',
            fontFamily:'var(--font-mono)', fontSize:7,
            color: allSelected ? 'var(--accent)' : 'var(--text-muted)',
            display:'flex', alignItems:'center', gap:4, transition:'all 0.15s',
          }}>
            <CheckSquare size={9}/>
            {allSelected ? 'QUITAR' : 'TODOS'}
          </button>
        </div>
        <div style={{ display:'flex', gap:5 }}>
          {allValues.map(v => {
            const active = values.includes(v)
            const label  = isTime ? `${v}′` : DIST_LABELS[v]
            return (
              <button key={v} onClick={() => toggleValue(v)} style={{
                flex:1, padding:'5px 2px', borderRadius:8, cursor:'pointer',
                background: active ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
                border:`1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily:'var(--font-mono)', fontSize:8,
                fontWeight: active ? 700 : 400, transition:'all 0.15s',
              }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Estado / error */}
      {loading && (
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)',
          animation:'pulse 1s infinite',
        }}>
          <Loader size={11} style={{ animation:'spin 1s linear infinite' }}/>
          Calculando isocronas...
        </div>
      )}
      {error && (
        <div style={{
          fontFamily:'var(--font-mono)', fontSize:9, color:'var(--red)',
          background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.2)',
          borderRadius:6, padding:'6px 8px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Leyenda */}
      {state.data && (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:8, letterSpacing:1, color:'var(--text-muted)', marginBottom:2 }}>
            LEYENDA
          </div>
          {[...values].reverse().map(v => (
            <div key={v} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                width:24, height:10, borderRadius:3,
                background: currentMode?.color,
                opacity: (ringOpacity[v] || 0.2) * 3,
                border: `1px solid ${currentMode?.color}`,
              }}/>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-secondary)' }}>
                {isTime ? `${v} min` : DIST_LABELS[v]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
