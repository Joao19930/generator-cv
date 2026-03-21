import React, { useEffect, useState } from 'react'
import { useCVStore } from '../../store/cvStore'

function calcProgress(store: ReturnType<typeof useCVStore.getState>): number {
  let score = 0
  if (store.personal.fullName) score += 1
  if (store.personal.email) score += 1
  if (store.personal.phone) score += 0.5
  if (store.personal.jobTitle) score += 1
  if (store.personal.address) score += 0.5
  if (store.summary && store.summary.length > 50) score += 1.5
  if (store.experience.length > 0) score += 1.5
  if (store.education.length > 0) score += 1
  if (store.skills.length >= 3) score += 1
  if (store.languages.length > 0) score += 0.5
  return Math.min(100, Math.round((score / 10) * 100))
}

function calcATS(store: ReturnType<typeof useCVStore.getState>): number {
  let s = 0
  if (store.personal.jobTitle) s += 15
  if (store.summary && store.summary.length > 100) s += 15
  if (store.skills.length >= 5) s += 20
  if (store.experience.length > 0) s += 20
  if (store.personal.email && store.personal.phone && store.personal.address) s += 15
  if (store.education.length > 0) s += 10
  if (store.personal.linkedin) s += 5
  return s
}

const AI_TIPS = [
  'Use verbos de ação como "implementei", "liderou" ou "reduziu" para mostrar impacto real.',
  'Quantifique resultados sempre que possível: "aumentei vendas em 30%" é mais forte que "melhorei vendas".',
  'Adapte o resumo profissional a cada vaga — use palavras-chave da descrição do emprego.',
  'Inclua pelo menos 5 competências técnicas relevantes para melhorar a pontuação ATS.',
  'Um CV de uma página é ideal para menos de 10 anos de experiência.',
]

const cardStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #2d3f55',
  borderRadius: 8,
  padding: 10,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#64748b',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 8,
}

export default function RightPanel() {
  const store = useCVStore()
  const progress = calcProgress(store)
  const atsScore = calcATS(store)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(i => (i + 1) % AI_TIPS.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Checklist items
  const checks = [
    { label: 'Pessoal', ok: !!(store.personal.fullName && store.personal.email) },
    { label: 'Resumo', ok: store.summary.length > 0 },
    { label: 'Experiência', ok: store.experience.length > 0 },
    { label: 'Formação', ok: store.education.length > 0 },
  ]

  // ATS arc
  const r = 25
  const circ = 2 * Math.PI * r // ~157
  const atsOffset = circ * (1 - atsScore / 100)
  const atsColor = atsScore >= 80 ? '#22c55e' : atsScore >= 40 ? '#b5a48a' : '#ef4444'
  const atsLabel = atsScore >= 80 ? 'Excelente' : atsScore >= 40 ? 'Bom' : 'Fraco'

  // ATS tip
  let atsTip = ''
  if (!store.personal.jobTitle) atsTip = 'Adicione o cargo profissional.'
  else if (!store.summary || store.summary.length <= 100) atsTip = 'Escreva um resumo mais detalhado.'
  else if (store.skills.length < 5) atsTip = 'Adicione pelo menos 5 competências.'
  else if (store.experience.length === 0) atsTip = 'Adicione experiência profissional.'
  else if (!store.personal.linkedin) atsTip = 'Inclua o perfil LinkedIn.'
  else atsTip = 'CV bem optimizado para ATS!'

  return (
    <div style={{
      width: 180,
      background: '#1e293b',
      borderLeft: '1px solid #334155',
      overflowY: 'auto',
      padding: '12px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Card 1 — Progresso */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Progresso do CV</div>

        {/* Progress bar */}
        <div style={{ width: '100%', height: 4, background: '#1e293b', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: '#b5a48a',
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Percentage */}
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#b5a48a', marginBottom: 10 }}>
          {progress}%
        </div>

        {/* Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {checks.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.ok ? '#b5a48a' : 'transparent',
                border: item.ok ? 'none' : '1.5px solid #334155',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 10, color: item.ok ? '#cbd5e1' : '#64748b', fontWeight: item.ok ? 500 : 400 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2 — Score ATS */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Score ATS</div>

        {/* SVG circle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <svg width={60} height={60} style={{ display: 'block' }}>
            {/* Background circle */}
            <circle
              cx={30}
              cy={30}
              r={r}
              fill="none"
              stroke="#1e293b"
              strokeWidth={5}
            />
            {/* Progress arc */}
            <circle
              cx={30}
              cy={30}
              r={r}
              fill="none"
              stroke={atsColor}
              strokeWidth={5}
              strokeDasharray={circ}
              strokeDashoffset={atsOffset}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '30px 30px', transition: 'stroke-dashoffset 0.5s ease' }}
            />
            {/* Score text */}
            <text
              x={30}
              y={34}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill="#f1f5f9"
              fontFamily="sans-serif"
            >
              {atsScore}
            </text>
          </svg>
        </div>

        {/* Label */}
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: atsColor, marginBottom: 6 }}>
          {atsLabel}
        </div>

        {/* Tip */}
        <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5, textAlign: 'center' }}>
          {atsTip}
        </div>
      </div>

      {/* Card 3 — Dica IA */}
      <div style={cardStyle}>
        <div style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', gap: 4 }}>
          Dica IA
          <span style={{ color: '#b5a48a', fontSize: 12 }}>✦</span>
        </div>
        <p style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5, margin: 0, transition: 'opacity 0.3s' }}>
          {AI_TIPS[tipIndex]}
        </p>
      </div>

      {/* Card 4 — Candidaturas */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Vagas</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', textAlign: 'center', marginBottom: 2 }}>
          0
        </div>
        <div style={{ fontSize: 9, color: '#64748b', textAlign: 'center', marginBottom: 8 }}>
          vagas guardadas
        </div>
        <div
          onClick={() => { window.location.href = '/empregos' }}
          style={{
            cursor: 'pointer',
            color: '#b5a48a',
            fontSize: 10,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          Ver vagas →
        </div>
      </div>
    </div>
  )
}
