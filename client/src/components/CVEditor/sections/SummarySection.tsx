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
        <span style={{ fontSize: 12, color: '#94A3B8' }}>
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
      {summary.length >= MAX_CHARS * 0.9 && (
        <p style={{ fontSize: 12, color: '#F59E0B' }}>
          A aproximar-se do limite de caracteres
        </p>
      )}
    </div>
  )
}
