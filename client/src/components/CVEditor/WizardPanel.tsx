import React, { useState } from 'react'
import { User, Briefcase, GraduationCap, Zap, FileText, Globe, ChevronRight, ChevronLeft, Check, ExternalLink } from 'lucide-react'
import PersonalSection from './sections/PersonalSection'
import ExperienceSection from './sections/ExperienceSection'
import EducationSection from './sections/EducationSection'
import SkillsSection from './sections/SkillsSection'
import LanguagesSection from './sections/LanguagesSection'
import SummarySection from './sections/SummarySection'
import { useCVStore } from '../../store/cvStore'

const STEPS = [
  { key: 'personal',   label: 'Info Pessoal', subtitle: 'Nome, contacto e foto',       icon: User,          tip: 'Email profissional e morada completa aumentam a confiança dos recrutadores.' },
  { key: 'experience', label: 'Experiência',  subtitle: 'Historial profissional',       icon: Briefcase,     tip: 'Use verbos de acção: "implementei", "liderei", "reduzi custos em 30%".' },
  { key: 'education',  label: 'Educação',     subtitle: 'Formação académica',           icon: GraduationCap, tip: 'Inclua a área de estudo — os sistemas ATS usam-na para filtrar candidatos.' },
  { key: 'skills',     label: 'Competências', subtitle: 'Habilidades e nível',          icon: Zap,           tip: 'Mínimo 5 competências para um bom score ATS.' },
  { key: 'languages',  label: 'Idiomas',      subtitle: 'Línguas que dominas',          icon: Globe,         tip: 'Incluir idiomas aumenta o score ATS e abre oportunidades internacionais.' },
  { key: 'summary',    label: 'Resumo',       subtitle: 'Apresentação profissional',    icon: FileText,      tip: 'Adapte o resumo a cada vaga com palavras-chave da oferta.' },
] as const

function isStepDone(i: number, store: ReturnType<typeof useCVStore.getState>): boolean {
  if (i === 0) return !!(store.personal.fullName && store.personal.email)
  if (i === 1) return store.experience.length > 0
  if (i === 2) return store.education.length > 0
  if (i === 3) return store.skills.length >= 2
  if (i === 4) return store.languages.length > 0
  if (i === 5) return store.summary.length > 30
  return false
}

function JobsBanner({ jobTitle }: { jobTitle: string }) {
  return (
    <div style={{ marginTop: 16, padding: '14px 16px', background: 'linear-gradient(135deg,#EFF6FF,#F0F9FF)', border: '1px solid #BFDBFE', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>CV pronto? Candidata-te agora</p>
          <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 1 }}>Vagas{jobTitle ? ` para ${jobTitle}` : ''} em Angola</p>
        </div>
      </div>
      <a href="/empregos" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', background: '#1E40AF', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
        onMouseLeave={e => (e.currentTarget.style.background = '#1E40AF')}
      >
        Ver vagas recomendadas <ExternalLink size={12} />
      </a>
    </div>
  )
}

export default function WizardPanel() {
  const [step, setStep] = useState(0)
  const store = useCVStore()
  const totalSteps = STEPS.length
  const currentStep = STEPS[step]
  const Icon = currentStep.icon
  const isLastStep = step === totalSteps - 1
  const cvDone = isLastStep && isStepDone(5, store)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A2540' }}>
      <style>{`
        @keyframes fadeSection { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── TOPO COMPACTO ──────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: '#0A2540', borderBottom: '1px solid #1a3a5c' }}>

        {/* Linha 1 — Steps horizontais (30px) */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 36, gap: 0 }}>
          {STEPS.map((s, i) => {
            const done = isStepDone(i, store)
            const active = i === step
            const StepIcon = s.icon
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 6px', borderRadius: 6,
                    borderBottom: active ? '2px solid #f59e0b' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {done && !active
                    ? <Check size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
                    : <StepIcon size={11} style={{ color: active ? '#f59e0b' : '#475569', flexShrink: 0 }} />
                  }
                  <span style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#f59e0b' : done ? '#22c55e' : '#475569',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </button>

                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: isStepDone(i, store) ? '#22c55e' : '#1a3a5c', minWidth: 8, maxWidth: 28 }} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Linha 2 — Título + subtítulo + tip (28px) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px', height: 28,
          borderTop: '1px solid #0d2d4a',
        }}>
          <Icon size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>
            {currentStep.label}
          </span>
          <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>—</span>
          <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
            {currentStep.subtitle}
          </span>
          <div style={{ width: 1, height: 14, background: '#1a3a5c', flexShrink: 0, margin: '0 2px' }} />
          <span style={{
            fontSize: 10, color: '#64748b', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            💡 {currentStep.tip}
          </span>
        </div>
      </div>

      {/* ── CONTEÚDO — ocupa todo o espaço disponível ──────── */}
      <div
        key={step}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '16px 16px 0',
          background: '#F5F7FA',
          animation: 'fadeSection 0.2s ease',
        }}
      >
        {step === 0 && <PersonalSection />}
        {step === 1 && <ExperienceSection />}
        {step === 2 && <EducationSection />}
        {step === 3 && <SkillsSection />}
        {step === 4 && <LanguagesSection />}
        {step === 5 && (
          <>
            <SummarySection />
            {cvDone && <JobsBanner jobTitle={store.personal.jobTitle} />}
          </>
        )}
      </div>

      {/* ── RODAPÉ COMPACTO ────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 38,
        borderTop: '1px solid #1a3a5c',
        background: '#0A2540', flexShrink: 0,
      }}>
        {/* Anterior */}
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none',
            color: step === 0 ? '#1a3a5c' : '#64748b',
            fontSize: 11, fontWeight: 600,
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            padding: '4px 6px',
          }}
        >
          <ChevronLeft size={13} /> Anterior
        </button>

        {/* Step count */}
        <span style={{ fontSize: 10, color: '#334155', fontWeight: 500, letterSpacing: '0.04em' }}>
          {step + 1} / {totalSteps}
        </span>

        {/* Seguinte / Completo */}
        {!isLastStep ? (
          <button
            type="button"
            onClick={() => setStep(s => Math.min(totalSteps - 1, s + 1))}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px',
              background: '#1E40AF',
              border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 11, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 6px rgba(30,64,175,0.3)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1E40AF')}
          >
            Seguinte <ChevronRight size={13} />
          </button>
        ) : (
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px',
              background: cvDone ? 'linear-gradient(135deg,#22C55E,#16A34A)' : '#0d2d4a',
              border: cvDone ? 'none' : '1px solid #1a3a5c',
              borderRadius: 6, color: cvDone ? '#fff' : '#475569',
              fontSize: 11, fontWeight: 700, cursor: 'default',
              transition: 'all 0.3s',
            }}
          >
            <Check size={13} />
            {cvDone ? 'CV Completo!' : 'Escreve o resumo…'}
          </button>
        )}
      </div>
    </div>
  )
}
