import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, X, Check, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface AIButtonProps {
  prompt: string
  onResult: (text: string) => void
  children?: React.ReactNode
  className?: string
}

export default function AIButton({ prompt, onResult, children, className = '' }: AIButtonProps) {
  const [loading, setLoading] = useState(false)
  const [fullText, setFullText] = useState<string | null>(null)
  const [displayText, setDisplayText] = useState('')
  const [showPopup, setShowPopup] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Typing animation
  useEffect(() => {
    if (!fullText) return
    setDisplayText('')
    setShowPopup(true)
    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      setDisplayText(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(intervalRef.current!)
      }
    }, 18)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fullText])

  async function handleClick() {
    if (!prompt.trim()) {
      toast.error('Preenche os campos obrigatórios primeiro')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error('Erro da API')
      const data = await res.json()
      const text = data.text || data.result || ''
      if (!text) throw new Error('Sem resposta')
      setFullText(text)
    } catch {
      toast.error('Erro ao gerar texto com IA')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (fullText) onResult(fullText)
    setShowPopup(false)
    setFullText(null)
    setDisplayText('')
    toast.success('✓ Aplicado ao CV!')
  }

  function handleDiscard() {
    setShowPopup(false)
    setFullText(null)
    setDisplayText('')
  }

  const isTyping = showPopup && displayText.length < (fullText?.length ?? 0)

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: loading ? '7px 14px' : '7px 14px',
          background: loading
            ? 'linear-gradient(90deg, #15803d, #22c55e, #15803d)'
            : 'linear-gradient(135deg, #22C55E, #16A34A)',
          backgroundSize: loading ? '200% 100%' : '100% 100%',
          animation: loading ? 'shimmer 1.4s linear infinite' : 'none',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.9 : 1,
          boxShadow: '0 2px 10px rgba(34,197,94,0.35)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          if (!loading) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(34,197,94,0.45)'
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px rgba(34,197,94,0.35)'
        }}
      >
        {loading ? (
          <>
            <div style={{
              width: 11, height: 11,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            A gerar com IA...
          </>
        ) : (
          <>
            <Wand2 size={12} />
            {children || 'Melhorar automaticamente com IA'}
          </>
        )}
      </button>

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {showPopup && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={handleDiscard} />
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: 0,
            width: 340,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: 16,
            zIndex: 99,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            animation: 'fadeInUp 0.2s ease',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={14} style={{ color: '#fff' }} />
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Sugestão IA</span>
                {isTyping && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 8 }}>a escrever…</span>}
              </div>
            </div>

            {/* Result text with cursor */}
            <div style={{
              fontSize: 12,
              color: '#cbd5e1',
              lineHeight: 1.7,
              marginBottom: 14,
              maxHeight: 180,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              minHeight: 40,
            }}>
              {displayText}
              {isTyping && <span style={{ display: 'inline-block', width: 2, height: 13, background: '#a78bfa', marginLeft: 1, animation: 'spin 1s step-end infinite', verticalAlign: 'middle' }} />}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleApply}
                disabled={isTyping}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '9px 14px',
                  background: isTyping ? '#334155' : 'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: '#fff',
                  border: 'none', borderRadius: 9,
                  fontSize: 13, fontWeight: 700,
                  cursor: isTyping ? 'wait' : 'pointer',
                  transition: 'opacity 0.15s',
                  opacity: isTyping ? 0.5 : 1,
                }}
              >
                <Check size={13} />
                Aplicar ao CV
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                style={{
                  padding: '9px 14px',
                  background: '#0f172a',
                  color: '#64748b',
                  border: '1px solid #334155',
                  borderRadius: 9,
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <X size={13} />
                Descartar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
