import { useState, useEffect } from 'react'
import { X, GitCompare, ChevronDown, ChevronUp, Users, TreePine, Loader } from 'lucide-react'

const API_BASE = '/api'

const CLASS_LABELS = [
  { name: 'Urbano/Construido',   color: '#ff6b6b', icon: '🏙️' },
  { name: 'Vegetación/Bosque',   color: '#51cf66', icon: '🌿' },
  { name: 'Agua',                color: '#339af0', icon: '💧' },
  { name: 'Suelo desnudo/Árido', color: '#ffd43b', icon: '🏜️' },
]

// Consulta al agente para obtener población y datos de la ciudad
async function fetchCityInfo(address) {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Dame SOLO estos datos de "${address}" en formato JSON sin explicación:
{"poblacion": "número con unidad (ej: 3.6M)", "area_km2": "número km²", "pais": "nombre del país", "continente": "continente"}
Si no tienes datos exactos usa estimaciones. Responde SOLO el JSON, nada más.`,
      }),
    })
    const data = await res.json()
    const text = data.response || ''
    // Extraer JSON de la respuesta
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) return JSON.parse(match[0])
    return null
  } catch { return null }
}

export default function CityCard({ data, label, onClose, onCompare, showCompare, onFlyTo }) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [cityInfo,   setCityInfo]   = useState(null)
  const [loadingInfo,setLoadingInfo]= useState(false)

  const dist     = data?.distribucion || {}
  const name     = data?.address || data?.ciudad || 'Ubicación'
  const greenPct = dist['Vegetación/Bosque']?.porcentaje || 0
  const waterPct = dist['Agua']?.porcentaje || 0
  const accent   = label === 'A' ? 'var(--accent)' : 'var(--amber)'
  const badge    = label === 'A' ? '#00d4ff' : '#ffaa00'

  // Consultar al agente cuando se monta la card
  useEffect(() => {
    if (!name || name === 'Ubicación') return
    setLoadingInfo(true)
    fetchCityInfo(name).then(info => {
      setCityInfo(info)
      setLoadingInfo(false)
    })
  }, [name])

  if (!data) return null

  return (
    <div className="fade-in-scale" style={{
      width: 280,
      background: 'rgba(6,12,20,0.97)',
      border: `1px solid ${label === 'A' ? 'rgba(0,212,255,0.2)' : 'rgba(255,170,0,0.2)'}`,
      borderRadius: 16,
      boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      backdropFilter: 'blur(16px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          background: `linear-gradient(135deg, ${label==='A' ? 'rgba(0,212,255,0.07)' : 'rgba(255,170,0,0.07)'}, transparent)`,
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: 'pointer',
        }}
        onClick={(e) => {
          // Si el click fue en los botones de colapsar/cerrar, no volar
          if (e.target.closest('button')) return
          if (onFlyTo) onFlyTo()
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: 7, background: badge, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#04080d',
        }}>{label}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
            color: accent,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
            ↗ ir a ubicación &nbsp;·&nbsp; {data.lat?.toFixed(4)}, {data.lng?.toFixed(4)}
            {data.size_km ? ` · ${data.size_km}km` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => setCollapsed(v => !v)} style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:'var(--text-muted)', padding:4,
          }}>
            {collapsed ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}
          </button>
          <button onClick={onClose} style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:'var(--text-muted)', padding:4,
          }}>
            <X size={13}/>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Stats: área verde + población */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>

            {/* Área verde */}
            <div style={{
              background: 'rgba(81,207,102,0.07)',
              border: '1px solid rgba(81,207,102,0.18)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                <TreePine size={9} color="#51cf66"/>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:7, color:'#51cf66', letterSpacing:1 }}>
                  ÁREA VERDE
                </span>
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:22, color:'#51cf66' }}>
                {greenPct.toFixed(1)}%
              </div>
              {waterPct > 0.1 && (
                <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'#339af0', marginTop:2 }}>
                  +{waterPct.toFixed(1)}% agua
                </div>
              )}
            </div>

            {/* Población via agente */}
            <div style={{
              background: `${label==='A' ? 'rgba(0,212,255,0.05)' : 'rgba(255,170,0,0.05)'}`,
              border: `1px solid ${label==='A' ? 'rgba(0,212,255,0.15)' : 'rgba(255,170,0,0.15)'}`,
              borderRadius: 8, padding: '8px 10px',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                <Users size={9} color={accent}/>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:7, color:accent, letterSpacing:1 }}>
                  POBLACIÓN
                </span>
              </div>
              {loadingInfo ? (
                <div style={{ display:'flex', alignItems:'center', gap:6, paddingTop:4 }}>
                  <Loader size={12} color="var(--text-muted)"
                    style={{ animation:'spin 1s linear infinite' }} />
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>
                    Consultando...
                  </span>
                </div>
              ) : cityInfo?.poblacion ? (
                <>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:22, color:accent }}>
                    {cityInfo.poblacion}
                  </div>
                  {cityInfo.area_km2 && (
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', marginTop:2 }}>
                      {cityInfo.area_km2} km²
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', paddingTop:4 }}>
                  No disponible
                </div>
              )}
            </div>
          </div>

          {/* País / continente si lo hay */}
          {cityInfo?.pais && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--text-muted)',
              display: 'flex', gap: 8,
            }}>
              <span>📍 {cityInfo.pais}</span>
              {cityInfo.continente && <span>· {cityInfo.continente}</span>}
            </div>
          )}

          {/* Leyenda LULC */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8, padding: '10px',
          }}>
            <div style={{
              fontFamily:'var(--font-mono)', fontSize:8, letterSpacing:2,
              color:'var(--text-muted)', marginBottom:8,
            }}>DISTRIBUCIÓN</div>

            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {CLASS_LABELS.map((cls, i) => {
                const pct = dist[cls.name]?.porcentaje || 0
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, flexShrink:0 }}>{cls.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-secondary)' }}>
                          {cls.name}
                        </span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:cls.color, fontWeight:700 }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ height:3, background:'rgba(255,255,255,0.04)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{
                          height:'100%', width:`${pct}%`, background:cls.color,
                          borderRadius:2, transition:'width 1s ease',
                          boxShadow:`0 0 5px ${cls.color}50`,
                        }}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Botón comparar */}
          {showCompare && onCompare && (
            <button onClick={onCompare} style={{
              width:'100%', padding:'8px', borderRadius:8, cursor:'pointer',
              background:'rgba(255,170,0,0.07)',
              border:'1px solid rgba(255,170,0,0.22)',
              color:'var(--amber)',
              fontFamily:'var(--font-mono)', fontSize:9, letterSpacing:1,
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              transition:'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,170,0,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,170,0,0.07)'}
            >
              <GitCompare size={12}/>
              COMPARAR CON OTRA CIUDAD
            </button>
          )}
        </div>
      )}
    </div>
  )
}
