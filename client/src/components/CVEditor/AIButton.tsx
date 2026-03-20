import React, { useState } from 'react'
import { Sparkles, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface AIButtonProps {
  prompt: string
  onResult: (text: string) => void
  children?: React.ReactNode
  className?: string
}

export default function AIButton({ prompt, onResult, children, className = '' }: AIButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [showPopup, setShowPopup] = useState(false)

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
      setResult(data.text || data.result || '')
      setShowPopup(true)
    } catch (err) {
      toast.error('Erro ao gerar texto com IA')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (result) {
      onResult(result)
      toast.success('Texto aplicado!')
    }
    setShowPopup(false)
    setResult(null)
  }

  function handleDiscard() {
    setShowPopup(false)
    setResult(null)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        style={{
          background: loading ? '#6d28d9' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
        }}
      >
        {loading ? (
          <>
            <div
              style={{
                width: 12,
                height: 12,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            A gerar...
          </>
        ) : (
          <>
            <Sparkles size={12} />
            {children || 'Melhorar com IA'}
          </>
        )}
      </button>

      {showPopup && result && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            width: 320,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 16,
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Sparkles size={14} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>Sugestão IA</span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: '#cbd5e1',
              lineHeight: 1.6,
              marginBottom: 12,
              maxHeight: 160,
              overflowY: 'auto',
            }}
          >
            {result}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleApply}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '7px 12px',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Check size={12} />
              Aplicar
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '7px 12px',
                background: '#334155',
                color: '#94a3b8',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <X size={12} />
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
