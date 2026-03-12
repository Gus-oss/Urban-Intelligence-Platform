import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User } from 'lucide-react'

const API_BASE = '/api'

const SUGGESTIONS = [
  '¿Cuántos patches tiene Ciudad de México?',
  'Compara la vegetación entre Nairobi y Amsterdam',
  '¿Qué ciudad tiene más suelo urbano?',
  'Explica qué es LULC y Sentinel-2',
  '¿Cuáles son los estándares ONU-Hábitat?',
]

export default function Chat({ selectedCity, cityName }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '👋 Hola. Soy el agente de Urban Intelligence. Puedo clasificar ciudades, comparar distribuciones LULC y responder preguntas sobre urbanismo y teledetección.\n\n¿En qué ciudad te enfocas hoy?',
    }
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)

    try {
      const res  = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, city: selectedCity }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response || data.detail || 'Sin respuesta del agente.',
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `⚠️ Error de conexión: ${err.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-deep)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-panel)',
      }}>
        <Bot size={14} color="var(--accent)" />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: 1 }}>
            AGENTE LULC
          </div>
          {cityName && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
              Contexto: {cityName}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10,
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            animation: 'fadeIn 0.25s ease',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: m.role === 'user' ? 'var(--accent-glow)' : 'rgba(0,255,136,0.1)',
              border: `1px solid ${m.role === 'user' ? 'var(--accent)' : 'var(--green)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.role === 'user'
                ? <User size={12} color="var(--accent)" />
                : <Bot  size={12} color="var(--green)"  />}
            </div>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: 8,
              background: m.role === 'user' ? 'var(--accent-glow)' : 'var(--bg-card)',
              border: `1px solid ${m.role === 'user' ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
              fontFamily: m.role === 'assistant' ? 'var(--font-mono)' : 'var(--font-display)',
              fontSize: m.role === 'assistant' ? 11 : 12,
              color: 'var(--text-primary)', lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, animation: 'fadeIn 0.25s ease' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,255,136,0.1)', border: '1px solid var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={12} color="var(--green)" />
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
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
        <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)';  e.target.style.color = 'var(--text-muted)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, background: 'var(--bg-panel)',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Escribe tu pregunta..."
          rows={1}
          style={{
            flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'none',
            outline: 'none', lineHeight: 1.5,
          }}
          onFocus={e  => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e   => e.target.style.borderColor = 'var(--border)'}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{
          width: 36, height: 36, borderRadius: 6, border: 'none',
          background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-card)',
          cursor: input.trim() && !loading ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s', flexShrink: 0,
        }}>
          <Send size={14} color={input.trim() && !loading ? 'var(--bg-deep)' : 'var(--text-muted)'} />
        </button>
      </div>
    </div>
  )
}
