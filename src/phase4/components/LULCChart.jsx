import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const CLASSES = [
  { key: 'Urbano/Construido',   color: '#ff6b6b', icon: '🏙️' },
  { key: 'Vegetación/Bosque',   color: '#51cf66', icon: '🌿' },
  { key: 'Agua',                color: '#339af0', icon: '💧' },
  { key: 'Suelo desnudo/Árido', color: '#ffd43b', icon: '🏜️' },
]

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
      borderRadius: 6, padding: '8px 12px',
      fontFamily: 'var(--font-mono)', fontSize: 10,
    }}>
      <div style={{ color: d.payload.color, fontWeight: 700 }}>{d.name}</div>
      <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
        {d.value.toFixed(1)}%
      </div>
    </div>
  )
}

export default function LULCChart({ data, loading, cityName }) {
  // Estado vacío
  if (!data && !loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
        fontSize: 10, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 28 }}>📊</div>
        <div style={{ letterSpacing: 1 }}>Presiona "CLASIFICAR CON U-NET"<br />para ver la distribución LULC</div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10,
      }}>
        <div style={{ fontSize: 28, animation: 'pulse 1s infinite' }}>🛰️</div>
        <div style={{ letterSpacing: 1, animation: 'pulse 1s infinite' }}>Clasificando patches...</div>
      </div>
    )
  }

  // Preparar datos para Recharts
  const dist = data?.distribucion || {}
  const chartData = CLASSES.map(c => ({
    name:  c.key,
    value: dist[c.key]?.porcentaje || 0,
    color: c.color,
    icon:  c.icon,
  })).filter(d => d.value > 0)

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Título */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)' }}>
        DISTRIBUCIÓN LULC — {cityName?.toUpperCase()}
      </div>

      {/* Info del resultado */}
      {data?.patches_clasificados && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 10px', lineHeight: 1.8,
        }}>
          <span style={{ color: 'var(--green)' }}>{data.patches_clasificados}</span> patches clasificados
          {data.confianza_promedio && (
            <> · confianza <span style={{ color: 'var(--accent)' }}>{(data.confianza_promedio * 100).toFixed(1)}%</span></>
          )}
        </div>
      )}

      {/* PieChart */}
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%" cy="50%"
              innerRadius={50} outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0} animationDuration={800}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color}
                  stroke="var(--bg-deep)"
                  strokeWidth={2}
                  style={{ filter: `drop-shadow(0 0 4px ${entry.color}60)` }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Barras */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CLASSES.map((cls, i) => {
          const pct = dist[cls.key]?.porcentaje || 0
          const px  = dist[cls.key]?.pixeles
          return (
            <div key={i}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>{cls.icon}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: pct > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                  }}>
                    {cls.key}
                  </span>
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: pct > 0 ? cls.color : 'var(--text-muted)', fontWeight: 700,
                }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--bg-card)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: cls.color,
                  boxShadow: pct > 0 ? `0 0 8px ${cls.color}` : 'none',
                  borderRadius: 2, transition: 'width 0.8s ease',
                }} />
              </div>
              {px !== undefined && (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8,
                  color: 'var(--text-muted)', marginTop: 2,
                }}>
                  {px?.toLocaleString()} px
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
