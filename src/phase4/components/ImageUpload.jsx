import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, Zap, FileCode } from 'lucide-react'

const API_BASE = '/api'

const CLASS_COLORS = [
  [255, 107, 107],  // 0 Urbano/Construido
  [81,  207, 102],  // 1 Vegetación/Bosque
  [51,  154, 240],  // 2 Agua
  [255, 212,  59],  // 3 Suelo desnudo/Árido
]

const CLASS_LABELS = [
  { name: 'Urbano/Construido',   color: '#ff6b6b', icon: '🏙️' },
  { name: 'Vegetación/Bosque',   color: '#51cf66', icon: '🌿' },
  { name: 'Agua',                color: '#339af0', icon: '💧' },
  { name: 'Suelo desnudo/Árido', color: '#ffd43b', icon: '🏜️' },
]

export default function ImageUpload() {
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]     = useState(null)
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const inputRef  = useRef(null)
  const canvasRef = useRef(null)

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['npy', 'tif', 'tiff'].includes(ext)) {
      setError(`Formato no soportado: .${ext} — Usa .npy o .tif`)
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  // Dibujar la máscara predicha en el canvas
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
      imgData.data[i * 4 + 3] = 220
    })
    ctx.putImageData(imgData, 0, 0)
  }, [result])

  const classify = async () => {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res  = await fetch(`${API_BASE}/upload-classify`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al clasificar'); return }
      setResult(data)
    } catch (err) {
      setError(`Error de conexión: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setFile(null); setResult(null); setError(null); setLoading(false) }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: 20, gap: 14, overflowY: 'auto', maxWidth: 700, margin: '0 auto', width: '100%',
    }}>

      {/* Título */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
        color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <FileCode size={10} color="var(--accent)" />
        CLASIFICAR IMAGEN SENTINEL-2 — 6 BANDAS
      </div>

      {/* Info */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        lineHeight: 1.8, background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px',
      }}>
        Sube un archivo <span style={{ color: 'var(--accent)' }}>.npy</span> o{' '}
        <span style={{ color: 'var(--accent)' }}>.tif</span> con 6 bandas Sentinel-2.<br />
        Shape esperado: <span style={{ color: 'var(--green)' }}>(6, H, W)</span> o{' '}
        <span style={{ color: 'var(--green)' }}>(H, W, 6)</span> — se redimensiona a 256×256 automáticamente.
      </div>

      {/* Drop zone */}
      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 10, padding: '48px 24px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.2s',
            background: dragging ? 'var(--accent-glow)' : 'transparent',
          }}
        >
          <input
            ref={inputRef} type="file" accept=".npy,.tif,.tiff"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
          <Upload
            size={32} color={dragging ? 'var(--accent)' : 'var(--text-muted)'}
            style={{ margin: '0 auto 14px', display: 'block' }}
          />
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: dragging ? 'var(--accent)' : 'var(--text-secondary)',
          }}>
            {dragging ? 'Suelta aquí' : 'Arrastra tu archivo o haz click para seleccionar'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 8 }}>
            Formatos aceptados: .npy · .tif · .tiff
          </div>
        </div>
      ) : (
        /* Archivo cargado */
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
          borderRadius: 8, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
              📄 {file.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button onClick={reset} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}>
            <X size={16} />
          </button>
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

      {/* Botón */}
      {file && !result && (
        <button onClick={classify} disabled={loading} style={{
          width: '100%', padding: '12px', borderRadius: 8,
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? 'transparent' : 'var(--accent-glow)',
          border: `1px solid ${loading ? 'var(--border)' : 'var(--accent)'}`,
          color: loading ? 'var(--text-muted)' : 'var(--accent)',
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
        }}>
          <Zap size={14} />
          {loading ? 'CLASIFICANDO...' : 'CLASIFICAR CON U-NET'}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-muted)', padding: '12px 0',
          animation: 'pulse 1s infinite',
        }}>
          🛰️ &nbsp; Ejecutando inferencia con el modelo U-Net...
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">

          {/* Máscara */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--text-muted)', marginBottom: 8,
            }}>
              MÁSCARA PREDICHA — {result.mask_size}×{result.mask_size}px
            </div>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%', height: 'auto', display: 'block',
                borderRadius: 8, border: '1px solid var(--border)',
                imageRendering: 'pixelated',
              }}
            />
            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
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

          {/* Distribución */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--text-muted)', marginBottom: 10,
            }}>
              DISTRIBUCIÓN LULC
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CLASS_LABELS.map((cls, i) => {
                const stats = result.distribucion?.[cls.name]
                const pct   = stats?.porcentaje || 0
                return (
                  <div key={i}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
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

          {/* Metadatos */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '10px 14px', lineHeight: 2,
          }}>
            <div>Archivo: <span style={{ color: 'var(--accent)' }}>{result.filename}</span></div>
            <div>Shape original: <span style={{ color: 'var(--green)' }}>{result.shape_original?.join(' × ')}</span></div>
          </div>

          {/* Nueva imagen */}
          <button onClick={reset} style={{
            width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            fontSize: 10, letterSpacing: 1, transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)';  e.target.style.color = 'var(--text-muted)' }}
          >
            ↑ SUBIR OTRA IMAGEN
          </button>
        </div>
      )}
    </div>
  )
}
