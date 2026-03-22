import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, X, Zap, FileCode } from 'lucide-react'

const API_BASE     = '/api'
const CLASS_COLORS = [[255,107,107],[81,207,102],[51,154,240],[255,212,59]]
const CLASS_LABELS = [
  { name: 'Urbano/Construido',   color: '#ff6b6b', icon: '🏙️' },
  { name: 'Vegetación/Bosque',   color: '#51cf66', icon: '🌿' },
  { name: 'Agua',                color: '#339af0', icon: '💧' },
  { name: 'Suelo desnudo/Árido', color: '#ffd43b', icon: '🏜️' },
]

export default function UploadModal({ onClose, onResult }) {
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]     = useState(null)
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [showMask, setShowMask] = useState(true)
  const inputRef  = useRef(null)
  const canvasRef = useRef(null)

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['npy','tif','tiff','jpg','jpeg','png'].includes(ext)) {
      setError(`Formato no soportado: .${ext}`)
      return
    }
    setFile(f); setResult(null); setError(null)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  useEffect(() => {
    if (!result?.mask_flat || !canvasRef.current) return
    const size = result.mask_size
    const canvas = canvasRef.current
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const imgData = ctx.createImageData(size, size)
    result.mask_flat.forEach((cls, i) => {
      const [r, g, b] = CLASS_COLORS[cls] || [128,128,128]
      imgData.data[i*4] = r; imgData.data[i*4+1] = g
      imgData.data[i*4+2] = b; imgData.data[i*4+3] = showMask ? 180 : 0
    })
    ctx.putImageData(imgData, 0, 0)
  }, [result, showMask])

  const classify = async () => {
    if (!file || loading) return
    setLoading(true); setError(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const controller = new AbortController()
      const timeout    = setTimeout(() => controller.abort(), 120000) // 2 min timeout

      const res = await fetch(`${API_BASE}/upload-classify`, {
        method: 'POST', body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      // Leer el texto primero para detectar respuesta vacía
      const text = await res.text()
      if (!text || text.trim() === '') {
        setError('El servidor devolvió una respuesta vacía. Verifica que el backend esté corriendo con src.phase5.api:app')
        return
      }

      let data
      try { data = JSON.parse(text) }
      catch { setError(`Respuesta inválida del servidor: ${text.slice(0, 100)}`); return }

      if (!res.ok) { setError(data.detail || `Error ${res.status}`); return }
      setResult(data)
      if (onResult) onResult(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Tiempo de espera agotado (2 min). La imagen puede ser demasiado grande.')
      } else {
        setError(`Error de conexión: ${err.message}`)
      }
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      background: 'rgba(4,8,13,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="fade-in-scale" style={{
        width: 520, maxHeight: '85vh',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-bright)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.06), transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={14} color="var(--accent)" />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2, color: 'var(--accent)' }}>
              CLASIFICAR IMAGEN · 6 BANDAS SENTINEL-2
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Formatos */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          }}>
            {[
              { ext: '.jpg / .png', icon: '🖼️', desc: 'RGB — conversión automática' },
              { ext: '.npy',        icon: '📊', desc: 'Array (6, H, W) float32' },
              { ext: '.tif',        icon: '🛰️', desc: 'GeoTIFF Sentinel-2' },
            ].map((f, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 10px',
              }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', marginBottom: 2 }}>{f.ext}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          {!file ? (
            <div
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: '32px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                background: dragging ? 'var(--accent-glow2)' : 'transparent',
              }}
            >
              <input ref={inputRef} type="file" accept=".npy,.tif,.tiff,.jpg,.jpeg,.png"
                style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              <Upload size={28} color={dragging ? 'var(--accent)' : 'var(--text-muted)'}
                style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                color: dragging ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {dragging ? 'Suelta aquí' : 'Arrastra o haz click'}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>
                  📄 {file.name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button onClick={() => setFile(null)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              }}>
                <X size={14} />
              </button>
            </div>
          )}

          {error && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--red)',
              background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)',
              borderRadius: 6, padding: '8px 12px',
            }}>⚠️ {error}</div>
          )}

          {file && !result && (
            <button onClick={classify} disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              background: loading ? 'transparent' : 'var(--accent-glow)',
              border: `1px solid ${loading ? 'var(--border)' : 'var(--accent)'}`,
              color: loading ? 'var(--text-muted)' : 'var(--accent)',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Zap size={13} />
              {loading ? 'CLASIFICANDO...' : 'CLASIFICAR CON U-NET'}
            </button>
          )}

          {loading && (
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--text-muted)', animation: 'pulse 1s infinite' }}>
              🛰️ &nbsp; Ejecutando inferencia...
            </div>
          )}

          {result && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Imagen + máscara */}
              <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden',
                cursor: 'pointer', border: '1px solid var(--border)' }}
                onClick={() => setShowMask(v => !v)}>
                {result.original_base64 && (
                  <img src={`data:image/png;base64,${result.original_base64}`}
                    style={{ width: '100%', display: 'block' }} alt="original" />
                )}
                <canvas ref={canvasRef} style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  imageRendering: 'pixelated', mixBlendMode: 'multiply',
                }} />
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'rgba(4,8,13,0.8)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 6px',
                  fontFamily: 'var(--font-mono)', fontSize: 8,
                  color: showMask ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {showMask ? 'MÁSCARA' : 'ORIGINAL'}
                </div>
              </div>
              {/* Distribución */}
              {CLASS_LABELS.map((cls, i) => {
                const pct = result.distribucion?.[cls.name]?.porcentaje || 0
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12 }}>{cls.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{cls.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: cls.color, fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: cls.color,
                          boxShadow: `0 0 6px ${cls.color}`, borderRadius: 2, transition: 'width 0.8s' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
