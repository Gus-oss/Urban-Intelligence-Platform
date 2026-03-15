import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { RefreshCw, Trophy } from 'lucide-react'

const API_BASE = '/api'

const CATEGORIES = [
  { key: 'Urbano/Construido',   label: 'Más Urbanas',  icon: '🏙️', color: '#ff6b6b', desc: 'Mayor % de suelo urbano/construido' },
  { key: 'Vegetación/Bosque',   label: 'Más Verdes',   icon: '🌿', color: '#51cf66', desc: 'Mayor cobertura vegetal y bosque' },
  { key: 'Agua',                label: 'Más Agua',     icon: '💧', color: '#339af0', desc: 'Mayor superficie de cuerpos de agua' },
  { key: 'Suelo desnudo/Árido', label: 'Más Áridas',   icon: '🏜️', color: '#ffd43b', desc: 'Mayor porcentaje de suelo árido/desnudo' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
      borderRadius: 6, padding: '8px 12px',
      fontFamily: 'var(--font-mono)', fontSize: 10,
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: payload[0].fill, fontWeight: 700 }}>
        {payload[0].value.toFixed(1)}%
      </div>
    </div>
  )
}

export default function Rankings() {
  const [rankings,  setRankings]  = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [computing, setComputing] = useState(false)
  const [active,    setActive]    = useState('Urbano/Construido')

  useEffect(() => {
    fetchRankings()
  }, [])

  const fetchRankings = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/rankings`)
      const data = await res.json()
      setRankings(data)
    } catch {
      setRankings(null)
    } finally {
      setLoading(false)
    }
  }

  const computeAll = async () => {
    setComputing(true)
    try {
      const res  = await fetch(`${API_BASE}/compute-rankings`, { method: 'POST' })
      const data = await res.json()
      setRankings(data)
    } catch {
      // error silencioso
    } finally {
      setComputing(false)
    }
  }

  const activeCat  = CATEGORIES.find(c => c.key === active)
  const cities     = rankings?.cities || {}
  const classified = Object.values(cities).filter(c => c.distribucion)

  // Construir datos del ranking para la categoría activa
  const rankData = Object.entries(cities)
    .filter(([, c]) => c.distribucion)
    .map(([key, c]) => ({
      key,
      name:  c.nombre?.split('/')[0]?.split(',')[0] || key,
      value: c.distribucion?.[active]?.porcentaje || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: '16px', gap: 14, overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Trophy size={10} color="var(--accent)" />
          RANKINGS LULC — {classified.length}/10 CIUDADES
        </div>
        <button
          onClick={fetchRankings}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Compute button si faltan ciudades */}
      {classified.length < 10 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 14px',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 10,
          }}>
            {10 - classified.length} ciudades sin clasificar. Puedes lanzar la
            clasificación de todas para completar los rankings.
            <br />
            <span style={{ color: '#ffaa00' }}>⚠️ Tarda ~15 min en CPU.</span>
          </div>
          <button onClick={computeAll} disabled={computing} style={{
            width: '100%', padding: '8px', borderRadius: 6,
            cursor: computing ? 'wait' : 'pointer',
            background: computing ? 'transparent' : 'rgba(255,170,0,0.1)',
            border: `1px solid ${computing ? 'var(--border)' : '#ffaa00'}`,
            color: computing ? 'var(--text-muted)' : '#ffaa00',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
            transition: 'all 0.2s',
          }}>
            {computing ? '⏳ Clasificando todas las ciudades...' : '🚀 CLASIFICAR TODAS LAS CIUDADES'}
          </button>
        </div>
      )}

      {/* Tabs de categoría */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setActive(cat.key)} style={{
            background: active === cat.key ? `${cat.color}20` : 'transparent',
            border: `1px solid ${active === cat.key ? cat.color : 'var(--border)'}`,
            borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1,
            color: active === cat.key ? cat.color : 'var(--text-muted)',
            transition: 'all 0.2s',
          }}>
            {cat.icon} {cat.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Descripción de categoría */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '6px 10px',
      }}>
        {activeCat?.desc}
      </div>

      {/* Sin datos */}
      {classified.length === 0 && !loading && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10,
          color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
          fontSize: 10, textAlign: 'center',
        }}>
          <div style={{ fontSize: 28 }}>📊</div>
          <div>Ninguna ciudad clasificada aún.<br />Clasifica ciudades desde el panel principal<br />o usa el botón de arriba.</div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
          animation: 'pulse 1s infinite',
        }}>
          Cargando rankings...
        </div>
      )}

      {/* Gráfica de barras */}
      {rankData.length > 0 && (
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
            color: 'var(--text-muted)', marginBottom: 10,
          }}>
            {activeCat?.icon} TOP {rankData.length} — {activeCat?.label.toUpperCase()}
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                <XAxis
                  type="number" domain={[0, 100]}
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-muted)' }}
                  tickFormatter={v => `${v}%`}
                />
                <YAxis
                  type="category" dataKey="name" width={80}
                  tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-secondary)' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {rankData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={activeCat?.color}
                      opacity={1 - i * 0.07}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lista detallada */}
      {rankData.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rankData.map((city, i) => (
            <div key={city.key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 6,
              background: i === 0 ? `${activeCat?.color}15` : 'var(--bg-card)',
              border: `1px solid ${i === 0 ? activeCat?.color + '40' : 'var(--border)'}`,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                color: i === 0 ? activeCat?.color : 'var(--text-muted)',
                width: 20, textAlign: 'center',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {city.name}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                color: activeCat?.color,
              }}>
                {city.value.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ciudades sin clasificar */}
      {Object.entries(cities).filter(([, c]) => !c.distribucion).length > 0 && (
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            SIN CLASIFICAR
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(cities)
              .filter(([, c]) => !c.distribucion)
              .map(([key, c]) => (
                <div key={key} style={{
                  padding: '4px 10px', borderRadius: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
                }}>
                  {c.nombre?.split(',')[0] || key}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
