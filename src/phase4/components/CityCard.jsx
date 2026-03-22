import { useState, useRef, useEffect } from 'react'
import { X, GitCompare, Zap, ChevronDown, ChevronUp } from 'lucide-react'

const CLASS_LABELS = [
  { name: 'Urbano/Construido',   color: '#ff6b6b', icon: '🏙️' },
  { name: 'Vegetación/Bosque',   color: '#51cf66', icon: '🌿' },
  { name: 'Agua',                color: '#339af0', icon: '💧' },
  { name: 'Suelo desnudo/Árido', color: '#ffd43b', icon: '🏜️' },
]

const CLASS_COLORS_RGB = [[255,107,107],[81,207,102],[51,154,240],[255,212,59]]

export default function CityCard({
  data,           // { address, distribucion, mask_flat, mask_size, original_base64, ... }
  position,       // 'left' | 'right'
  onClose,
  onCompare,      // solo en la card izquierda
  showCompare,    // mostrar botón comparar
  label,          // 'A' | 'B'
}) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [showMask,   setShowMask]   = useState(true)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!data?.mask_flat || !canvasRef.current || collapsed) return
    const size    = data.mask_size || 256
    const canvas  = canvasRef.current
    canvas.width  = size
    canvas.height = size
    const ctx     = canvas.getContext('2d')
    const imgData = ctx.createImageData(size, size)
    data.mask_flat.forEach((cls, i) => {
      const [r, g, b] = CLASS_COLORS_RGB[cls] || [128,128,128]
      imgData.data[i * 4]     = r
      imgData.data[i * 4 + 1] = g
      imgData.data[i * 4 + 2] = b
      imgData.data[i * 4 + 3] = showMask ? 180 : 0
    })
    ctx.putImageData(imgData, 0, 0)
  }, [data, collapsed, showMask])

  if (!data) return null

  const dist = data.distribucion || {}
  const name = data.address || data.ciudad || 'Ubicación'

  return (
    <div className="fade-in-scale" style={{
      width: 280,
      background: 'rgba(8,15,24,0.95)',
      border: '1px solid var(--border-bright)',
      borderRadius: 14,
      boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.08)',
      overflow: 'hidden',
      backdropFilter: 'blur(12px)',
      transition: 'all 0.3s',
    }}>
      {/* Header de la card */}
      <div style={{
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        background: 'linear-gradient(135deg, rgba(0,212,255,0.06), transparent)',
      }}>
        {/* Badge A/B */}
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: label === 'A' ? 'var(--accent)' : 'var(--amber)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          color: '#04080d',
        }}>
          {label}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
            color: 'var(--text-primary)', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {name}
          </div>
          {data.size_km && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>
              {data.size_km}×{data.size_km} km
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setCollapsed(v => !v)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 3,
          }}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 3,
          }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Contenido expandido */}
      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Imagen + máscara */}
          {data.original_base64 && (
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => setShowMask(v => !v)}
              title={showMask ? 'Click para ver imagen original' : 'Click para ver máscara LULC'}
            >
              <img
                src={`data:image/png;base64,${data.original_base64}`}
                style={{ width: '100%', display: 'block', borderRadius: 8 }}
                alt="Sentinel-2"
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  imageRendering: 'pixelated',
                  mixBlendMode: 'multiply',
                  transition: 'opacity 0.3s',
                }}
              />
              <div style={{
                position: 'absolute', top: 6, right: 6,
                background: 'rgba(4,8,13,0.8)',
                border: '1px solid var(--border)',
                borderRadius: 4, padding: '2px 6px',
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: showMask ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                {showMask ? 'MÁSCARA' : 'ORIGINAL'}
              </div>
            </div>
          )}

          {/* Distribución */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CLASS_LABELS.map((cls, i) => {
              const pct = dist[cls.name]?.porcentaje || 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>{cls.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      marginBottom: 3,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 8,
                        color: 'var(--text-secondary)',
                      }}>
                        {cls.name}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9,
                        color: cls.color, fontWeight: 700,
                      }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      height: 3, background: 'rgba(255,255,255,0.05)',
                      borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: cls.color,
                        boxShadow: `0 0 6px ${cls.color}80`,
                        borderRadius: 2, transition: 'width 0.8s ease',
                      }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botón comparar */}
          {showCompare && onCompare && (
            <button onClick={onCompare} style={{
              width: '100%', padding: '7px', borderRadius: 8,
              cursor: 'pointer',
              background: 'rgba(255,170,0,0.08)',
              border: '1px solid rgba(255,170,0,0.3)',
              color: 'var(--amber)',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,170,0,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,170,0,0.08)'}
            >
              <GitCompare size={12} />
              COMPARAR CON OTRA CIUDAD
            </button>
          )}
        </div>
      )}
    </div>
  )
}
