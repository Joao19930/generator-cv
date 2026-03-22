import { useCVStore } from '../../../store/cvStore'
import AIButton from '../AIButton'

const MAX_CHARS = 400

export default function SummarySection() {
  const { summary, setSummary, personal, experience } = useCVStore()

  const expList = experience.map(e => `${e.role} na ${e.company}`).join('; ') || 'não especificado'
  const aiPrompt = [
    `Escreve um resumo profissional em português para um CV.`,
    `Nome: ${personal.fullName || 'não especificado'}`,
    `Cargo: ${personal.jobTitle || 'não especificado'}`,
    `Experiências: ${expList}`,
    `Regras: máximo 3 frases, máximo 350 caracteres, começa directamente com o cargo ou nome, sem aspas, sem títulos, sem explicações — apenas o texto do resumo.`,
  ].join('\n')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {summary.length}/{MAX_CHARS} caracteres
        </span>
        <AIButton prompt={aiPrompt} onResult={setSummary}>
          Gerar com IA
        </AIButton>
      </div>
      <textarea
        value={summary}
        onChange={e => setSummary(e.target.value.slice(0, MAX_CHARS))}
        placeholder="Breve resumo sobre a tua experiência, competências e objectivos profissionais..."
        rows={5}
        style={{
          width: '100%',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '10px 12px',
          color: '#f8fafc',
          fontSize: 13,
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => (e.target.style.borderColor = '#f59e0b')}
        onBlur={e => (e.target.style.borderColor = '#334155')}
      />
      {summary.length >= MAX_CHARS * 0.9 && (
        <p style={{ fontSize: 11, color: '#f59e0b' }}>
          A aproximar-se do limite de caracteres
        </p>
      )}
    </div>
  )
}
