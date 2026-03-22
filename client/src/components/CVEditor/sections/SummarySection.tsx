import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { useCVStore } from '../../../store/cvStore'

const MAX_CHARS = 700

export default function SummarySection() {
  const { summary, setSummary, personal, experience } = useCVStore()
  const [aiLoading, setAiLoading] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [prevSummary, setPrevSummary] = useState('')

  const expList = experience.map(e => `${e.role} na ${e.company}`).join('; ') || 'não especificado'
  const aiPrompt = [
    `Escreve um resumo profissional em português para um CV.`,
    `Nome: ${personal.fullName || 'não especificado'}`,
    `Cargo: ${personal.jobTitle || 'não especificado'}`,
    `Experiências: ${expList}`,
    `Regras: máximo 4 frases, máximo 600 caracteres, começa directamente com o cargo ou nome, sem aspas, sem títulos, sem explicações — apenas o texto do resumo.`,
  ].join('\n')

  async function handleGenerate() {
    setPrevSummary(summary)
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const data = await res.json()
      if (data.text) {
        const text = data.text.slice(0, MAX_CHARS)
        setDraft(text)
        setSummary(text)
      }
    } catch {}
    setAiLoading(false)
  }

  function handleManter() {
    setDraft(null)
  }

  function handleDescartar() {
    setSummary(prevSummary)
    setDraft(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>
          {summary.length}/{MAX_CHARS} caracteres
        </span>
        {!draft && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={aiLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px',
              background: aiLoading ? '#E2E8F0' : 'linear-gradient(135deg,#22C55E,#16A34A)',
              border: 'none', borderRadius: 6,
              color: aiLoading ? '#94A3B8' : '#fff',
              fontSize: 11, fontWeight: 700,
              cursor: aiLoading ? 'wait' : 'pointer',
            }}
          >
            <Wand2 size={11} />
            {aiLoading ? 'A gerar...' : 'Gerar com IA'}
          </button>
        )}
      </div>

      <textarea
        value={summary}
        onChange={e => {
          const v = e.target.value.slice(0, MAX_CHARS)
          setSummary(v)
          if (draft !== null) setDraft(v)
        }}
        placeholder="Breve resumo sobre a tua experiência, competências e objectivos profissionais..."
        rows={6}
        style={{
          width: '100%',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: '12px 14px',
          color: '#1E293B',
          fontSize: 14,
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
        onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
      />

      {draft !== null && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleManter}
            style={{
              flex: 1, padding: '7px 0',
              background: 'linear-gradient(135deg,#22C55E,#16A34A)',
              border: 'none', borderRadius: 7,
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ✓ Manter
          </button>
          <button
            type="button"
            onClick={handleDescartar}
            style={{
              flex: 1, padding: '7px 0',
              background: '#F1F5F9',
              border: '1px solid #E2E8F0', borderRadius: 7,
              color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✕ Descartar
          </button>
        </div>
      )}

      {summary.length >= MAX_CHARS * 0.9 && (
        <p style={{ fontSize: 12, color: '#F59E0B', margin: 0 }}>
          A aproximar-se do limite de caracteres
        </p>
      )}
    </div>
  )
}
