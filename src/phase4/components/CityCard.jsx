import { useState, useRef, useEffect } from 'react'
import { X, GitCompare, ChevronDown, ChevronUp, Users, TreePine } from 'lucide-react'

const CLASS_LABELS = [
  { name: 'Urbano/Construido',   color: '#ff6b6b', icon: '🏙️', rgb: [255,107,107] },
  { name: 'Vegetación/Bosque',   color: '#51cf66', icon: '🌿', rgb: [81,207,102]  },
  { name: 'Agua',                color: '#339af0', icon: '💧', rgb: [51,154,240]  },
  { name: 'Suelo desnudo/Árido', color: '#ffd43b', icon: '🏜️', rgb: [255,212,59]  },
]

const POPULATION_DATA = {
  'berlin':    { pop: '3.6M',  area: '891 km²'   },
  'paris':     { pop: '2.1M',  area: '105 km²'   },
  'london':    { pop: '9.0M',  area: '1,572 km²' },
  'new york':  { pop: '8.3M',  area: '783 km²'   },
  'tokyo':     { pop: '13.9M', area: '2,194 km²' },
  'mexico':    { pop: '9.2M',  area: '1,485 km²' },
  'amsterdam': { pop: '921K',  area: '219 km²'   },
  'madrid':    { pop: '3.3M',  area: '604 km²'   },
  'dubai':     { pop: '3.6M',  area: '4,114 km²' },
  'mumbai':    { pop: '12.5M', area: '603 km²'   },
  'nairobi':   { pop: '4.4M',  area: '696 km²'   },
  'bangkok':   { pop: '10.5M', area: '1,569 km²' },
  'bogota':    { pop: '7.4M',  area: '1,775 km²' },
  'houston':   { pop: '2.3M',  area: '1,777 km²' },
  'monterrey': { pop: '1.1M',  area: '325 km²'   },
  'sao paulo': { pop: '12.3M', area: '1,521 km²' },
  'shanghai':  { pop: '24.8M', area: '6,340 km²' },
  'cairo':     { pop: '21.3M', area: '3,085 km²' },
  'lagos':     { pop: '14.8M', area: '1,171 km²' },
}

function getPopInfo(address) {
  if (!address) return null
  const lower = address.toLowerCase()
  for (const [key, val] of Object.entries(POPULATION_DATA)) {
    if (lower.includes(key)) return val
  }
  return null
}

export default function CityCard({ data, label, onClose, onCompare, showCompare }) {
  const [collapsed, setCollapsed] = useState(false)
  const [showMask,  setShowMask]  = useState(true)
  const canvasRef = useRef(null)

  const dist     = data?.distribucion || {}
  const name     = data?.address || data?.ciudad || 'Ubicación'
  const popInfo  = getPopInfo(name)
  const greenPct = dist['Vegetación/Bosque']?.porcentaje || 0
  const waterPct = dist['Agua']?.porcentaje || 0
  const accent   = label === 'A' ? 'var(--accent)' : 'var(--amber)'
  const badge    = label === 'A' ? '#00d4ff' : '#ffaa00'

  useEffect(() => {
    if (!data?.mask_flat || !canvasRef.current || collapsed) return
    const size = data.mask_size || 256
    const canvas = canvasRef.current
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(size, size)
    data.mask_flat.forEach((cls, i) => {
      const [r, g, b] = CLASS_LABELS[cls]?.rgb || [128,128,128]
      img.data[i*4] = r; img.data[i*4+1] = g
      img.data[i*4+2] = b; img.data[i*4+3] = showMask ? 185 : 0
    })
    ctx.putImageData(img, 0, 0)
  }, [data, collapsed, showMask])

  if (!data) return null

  return (
    <div className="fade-in-scale" style={{
      width: 290,
      background: 'rgba(6,12,20,0.97)',
      border: `1px solid ${label === 'A' ? 'rgba(0,212,255,0.2)' : 'rgba(255,170,0,0.2)'}`,
      borderRadius: 16,
      boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      backdropFilter: 'blur(16px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        background: `linear-gradient(135deg, ${label==='A' ? 'rgba(0,212,255,0.07)' : 'rgba(255,170,0,0.07)'}, transparent)`,
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 7, background: badge, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#04080d',
        }}>{label}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
            {data.lat?.toFixed(4)}, {data.lng?.toFixed(4)}
            {data.size_km ? ` · área ${data.size_km}×${data.size_km} km` : ''}
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

          {/* Imagen Sentinel-2 + máscara */}
          {data.original_base64 && (
            <div style={{
              position: 'relative', borderRadius: 10, overflow: 'hidden',
              cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)',
            }} onClick={() => setShowMask(v => !v)}>
              <img src={`data:image/png;base64,${data.original_base64}`}
                style={{ width: '100%', display: 'block' }} alt="Sentinel-2" />
              <canvas ref={canvasRef} style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                imageRendering: 'pixelated', mixBlendMode: 'multiply',
              }}/>
              <div style={{
                position: 'absolute', top: 6, right: 6,
                background: 'rgba(4,8,13,0.85)',
                border: `1px solid ${showMask ? accent : 'var(--border)'}`,
                borderRadius: 5, padding: '2px 7px',
                fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: 1,
                color: showMask ? accent : 'var(--text-muted)',
              }}>
                {showMask ? 'LULC' : 'RGB'}
              </div>
            </div>
          )}

          {/* Stats rápidas: área verde + población */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{
              background: 'rgba(81,207,102,0.07)',
              border: '1px solid rgba(81,207,102,0.18)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <TreePine size={9} color="#51cf66"/>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:7, color:'#51cf66', letterSpacing:1 }}>
                  ÁREA VERDE
                </span>
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:20, color:'#51cf66' }}>
                {greenPct.toFixed(1)}%
              </div>
              {waterPct > 0.1 && (
                <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', marginTop:2 }}>
                  +{waterPct.toFixed(1)}% agua
                </div>
              )}
            </div>
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
              {popInfo ? (
                <>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:20, color:accent }}>
                    {popInfo.pop}
                  </div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', marginTop:2 }}>
                    {popInfo.area}
                  </div>
                </>
              ) : (
                <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', paddingTop:6 }}>
                  No disponible
                </div>
              )}
            </div>
          </div>

          {/* Leyenda LULC */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 8, padding: '10px',
          }}>
            <div style={{
              fontFamily:'var(--font-mono)', fontSize:8, letterSpacing:2,
              color:'var(--text-muted)', marginBottom:8,
            }}>DISTRIBUCIÓN LULC</div>
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
                          boxShadow:`0 0 6px ${cls.color}60`,
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
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,170,0,0.14)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,170,0,0.07)' }}
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
