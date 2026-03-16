import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, Zap, FileCode, Layers } from 'lucide-react'

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

const FORMATS = [
  { ext: '.jpg / .png', desc: 'Imagen RGB — conversión automática a 6 bandas', icon: '🖼️' },
  { ext: '.npy',        desc: 'Array numpy (6, H, W) — formato nativo del modelo', icon: '📊' },
  { ext: '.tif',        desc: 'GeoTIFF Sentinel-2 con 6 bandas reales', icon: '🛰️' },
]

export default function ImageUpload() {
  const [dragging,  setDragging]  = useState(false)
  const [file,      setFile]      = useState(null)
  const [preview,   setPreview]   = useState(null)  // URL preview local
  const [result,    setResult]    = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [opacity,   setOpacity]   = useState(0.55)  // opacidad de la máscara
  const [showMask,  setShowMask]  = useState(true)
  const inputRef    = useRef(null)
  const canvasRef   = useRef(null)  // canvas de la máscara overlay
  const imgRef      = useRef(null)  // imagen original

  const handleFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['npy', 'tif', 'tiff', 'jpg', 'jpeg', 'png'].includes(ext)) {
      setError(`Formato no soportado: .${ext}`)
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
    // Preview local solo para imágenes RGB
    if (['jpg', 'jpeg', 'png'].includes(ext)) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  // Dibujar máscara en canvas cuando llega el resultado
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
      imgData.data[i * 4 + 3] = showMask ? Math.round(opacity * 255) : 0
    })
    ctx.putImageData(imgData, 0, 0)
  }, [result, opacity, showMask])

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

  const reset = () => {
    setFile(null); setPreview(null); setResult(null)
    setError(null); setLoading(false)
  }

  // Imagen original a mostrar: base64 del backend o preview local
  const originalSrc = result?.original_base64
    ? `data:image/png;base64,${result.original_base64}`
    : preview

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      padding: 20, gap: 14, overflowY: 'auto',
      maxWidth: 720, margin: '0 auto', width: '100%',
    }}>

      {/* Título */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
        color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Layers size={10} color="var(--accent)" />
        CLASIFICAR IMAGEN — SEGMENTACIÓN LULC
      </div>

      {/* Formatos aceptados */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        {FORMATS.map((f, i) => (
          <div key={i} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 10px',
          }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{f.icon}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', marginBottom: 3 }}>
              {f.ext}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {f.desc}
            </div>
          </div>
        ))}
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
            ref={inputRef} type="file"
            accept=".npy,.tif,.tiff,.jpg,.jpeg,.png"
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
            {dragging ? 'Suelta aquí' : 'Arrastra tu imagen o haz click'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 8 }}>
            .jpg · .png · .npy · .tif · .tiff
          </div>
        </div>
      ) : (
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

      {/* Preview local antes de clasificar */}
      {preview && !result && (
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            VISTA PREVIA
          </div>
          <img src={preview} alt="preview" style={{
            width: '100%', borderRadius: 8,
            border: '1px solid var(--border)', display: 'block',
          }} />
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

      {/* Botón clasificar */}
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

      {loading && (
        <div style={{
          textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-muted)', animation: 'pulse 1s infinite',
        }}>
          🛰️ &nbsp; Ejecutando inferencia con el modelo U-Net...
        </div>
      )}

      {/* ── RESULTADO: imagen original + máscara overlay ── */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">

          {/* Controles de overlay */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <button onClick={() => setShowMask(v => !v)} style={{
              background: showMask ? 'var(--accent-glow)' : 'transparent',
              border: `1px solid ${showMask ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: showMask ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}>
              {showMask ? '🎨 MÁSCARA ON' : '🎨 MÁSCARA OFF'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                OPACIDAD
              </span>
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={opacity}
                onChange={e => setOpacity(parseFloat(e.target.value))}
                disabled={!showMask}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', width: 32 }}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
          </div>

          {/* Imagen original + canvas overlay superpuesto */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--text-muted)', marginBottom: 8,
            }}>
              SEGMENTACIÓN LULC — {result.mask_size}×{result.mask_size}px
            </div>

            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {/* Imagen original */}
              {originalSrc ? (
                <img
                  ref={imgRef}
                  src={originalSrc}
                  alt="original"
                  style={{ width: '100%', display: 'block' }}
                />
              ) : (
                /* Si no hay imagen (npy sin preview) mostrar fondo oscuro */
                <div style={{ width: '100%', paddingTop: '100%', background: 'var(--bg-deep)' }} />
              )}

              {/* Máscara superpuesta */}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  imageRendering: 'pixelated',
                  mixBlendMode: 'multiply',
                }}
              />
            </div>

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {CLASS_LABELS.map((cls, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: cls.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                    {cls.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribución LULC */}
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
              color: 'var(--text-muted)', marginBottom: 10,
            }}>
              DISTRIBUCIÓN LULC
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CLASS_LABELS.map((cls, i) => {
                const pct = result.distribucion?.[cls.name]?.porcentaje || 0
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
            <div>Shape: <span style={{ color: 'var(--green)' }}>{result.shape_original?.join(' × ')}</span></div>
            {result.original_size && (
              <div>Resolución original: <span style={{ color: 'var(--green)' }}>{result.original_size[0]} × {result.original_size[1]} px</span></div>
            )}
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
