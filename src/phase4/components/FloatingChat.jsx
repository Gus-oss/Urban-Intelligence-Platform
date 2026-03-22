import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, User } from 'lucide-react'

const API_BASE = '/api'

const SUGGESTIONS = [
  '¿Qué es LULC?',
  '¿Cómo funciona Sentinel-2?',
  'Explica el modelo U-Net',
  'Estándares ONU-Hábitat',
]

export default function FloatingChat({ selectedLocation }) {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: '👋 Soy UrbanAI. Pregúntame sobre clasificación de uso de suelo, urbanismo o teledetección.',
  }])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const endRef    = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, open])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)

    try {
      const res  = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          city: selectedLocation?.city || null,
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response || data.detail || 'Sin respuesta.',
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `⚠️ Error: ${err.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12,
    }}>
      {/* Chat panel */}
      {open && (
        <div className="fade-in-scale" style={{
          width: 340, height: 460,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,212,255,0.03))',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--green))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>🛰️</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                  UrbanAI
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: 1 }}>
                  ASISTENTE LULC
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, borderRadius: 6,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8,
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: m.role === 'user'
                    ? 'rgba(0,212,255,0.15)' : 'rgba(0,255,136,0.1)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(0,212,255,0.4)' : 'rgba(0,255,136,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {m.role === 'user'
                    ? <User size={11} color="var(--accent)" />
                    : <Bot  size={11} color="var(--green)"  />}
                </div>
                <div style={{
                  maxWidth: '82%', padding: '8px 12px', borderRadius: 10,
                  background: m.role === 'user'
                    ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(0,212,255,0.2)' : 'var(--border)'}`,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--text-primary)', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(0,255,136,0.1)',
                  border: '1px solid rgba(0,255,136,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={11} color="var(--green)" />
                </div>
                <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  {[0,1,2].map(j => (
                    <div key={j} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--text-muted)',
                      animation: `pulse 1.2s ease ${j * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{
                  background: 'rgba(0,212,255,0.05)',
                  border: '1px solid rgba(0,212,255,0.15)',
                  borderRadius: 20, padding: '3px 10px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 8,
                  color: 'var(--text-muted)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.target.style.borderColor = 'rgba(0,212,255,0.15)'; e.target.style.color = 'var(--text-muted)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Escribe tu pregunta..."
              style={{
                flex: 1, background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '7px 11px', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: 10, outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e  => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e   => e.target.style.borderColor = 'var(--border)'}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-hover)',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', flexShrink: 0,
            }}>
              <Send size={13} color={input.trim() && !loading ? '#04080d' : 'var(--text-muted)'} />
            </button>
          </div>
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          cursor: 'pointer', position: 'relative',
          background: open
            ? 'var(--bg-card)'
            : 'linear-gradient(135deg, var(--accent), #0099dd)',
          boxShadow: open
            ? 'var(--shadow-card)'
            : '0 4px 20px rgba(0,212,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.3s',
          animation: open ? 'none' : 'glow 3s ease infinite',
        }}
      >
        {open
          ? <X size={20} color="var(--text-secondary)" />
          : <MessageCircle size={22} color="white" />
        }
        {/* Ripple */}
        {!open && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid var(--accent)',
            animation: 'ripple 2s ease infinite',
          }} />
        )}
      </button>
    </div>
  )
}
