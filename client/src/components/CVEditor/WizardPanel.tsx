import React, { useState } from 'react'
import { User, Briefcase, GraduationCap, Zap, FileText, ChevronRight, ChevronLeft, Check, ExternalLink } from 'lucide-react'
import PersonalSection from './sections/PersonalSection'
import ExperienceSection from './sections/ExperienceSection'
import EducationSection from './sections/EducationSection'
import SkillsSection from './sections/SkillsSection'
import SummarySection from './sections/SummarySection'
import { useCVStore } from '../../store/cvStore'

const STEPS = [
  {
    key: 'personal',
    label: 'Info Pessoal',
    subtitle: 'Nome, contacto e foto',
    icon: User,
    tip: '💡 Um email profissional e uma morada completa aumentam a confiança dos recrutadores.',
  },
  {
    key: 'experience',
    label: 'Experiência',
    subtitle: 'Historial profissional',
    icon: Briefcase,
    tip: '💡 Use verbos de acção: "implementei", "liderei", "reduzi custos em 30%". Resultados concretos destacam-se.',
  },
  {
    key: 'education',
    label: 'Educação',
    subtitle: 'Formação académica',
    icon: GraduationCap,
    tip: '💡 Inclua a área de estudo — os sistemas ATS usam-na para filtrar candidatos por perfil.',
  },
  {
    key: 'skills',
    label: 'Competências',
    subtitle: 'Habilidades e nível',
    icon: Zap,
    tip: '💡 Mínimo 5 competências para um bom score ATS. Inclua ferramentas e tecnologias específicas da sua área.',
  },
  {
    key: 'summary',
    label: 'Resumo',
    subtitle: 'Apresentação profissional',
    icon: FileText,
    tip: '💡 Adapte o resumo a cada vaga com palavras-chave da descrição do emprego.',
  },
] as const


function isStepDone(i: number, store: ReturnType<typeof useCVStore.getState>): boolean {
  if (i === 0) return !!(store.personal.fullName && store.personal.email)
  if (i === 1) return store.experience.length > 0
  if (i === 2) return store.education.length > 0
  if (i === 3) return store.skills.length >= 2
  if (i === 4) return store.summary.length > 30
  return false
}

/** Banner de vagas — mostrado no último passo após conclusão */
function JobsBanner({ jobTitle }: { jobTitle: string }) {
  return (
    <div style={{
      marginTop: 20,
      padding: '16px 18px',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)',
      border: '1px solid #BFDBFE',
      borderRadius: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>CV pronto? Candidata-te agora</p>
          <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2 }}>
            Vagas disponíveis{jobTitle ? ` para ${jobTitle}` : ''} em Angola
          </p>
        </div>
      </div>
      <a
        href="/empregos"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '9px 16px',
          background: '#1E40AF',
          borderRadius: 10,
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(30,64,175,0.2)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
        onMouseLeave={e => (e.currentTarget.style.background = '#1E40AF')}
      >
        Ver vagas recomendadas
        <ExternalLink size={13} />
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
  const cvDone = isLastStep && isStepDone(4, store)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d2d4a' }}>

      {/* Step indicators — dark */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a3a5c', background: '#0A2540' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {STEPS.map((s, i) => {
            const done = isStepDone(i, store)
            const active = i === step
            const StepIcon = s.icon
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px' }}
                  onMouseEnter={e => { const circle = (e.currentTarget as HTMLButtonElement).querySelector('div') as HTMLElement; if (circle) circle.style.transform = 'scale(1.05)' }}
                  onMouseLeave={e => { const circle = (e.currentTarget as HTMLButtonElement).querySelector('div') as HTMLElement; if (circle) circle.style.transform = 'scale(1)' }}
                >
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? '#1E40AF' : done ? '#22C55E' : '#F1F5F9',
                    border: `2px solid ${active ? '#1E40AF' : done ? '#22C55E' : '#E2E8F0'}`,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}>
                    {done && !active
                      ? <Check size={15} style={{ color: '#FFFFFF' }} />
                      : <StepIcon size={15} style={{ color: active ? '#FFFFFF' : '#94A3B8' }} />
                    }
                  </div>
                  <span style={{
                    fontSize: 9,
                    fontWeight: active ? 700 : 500,
                    color: active ? '#1E40AF' : done ? '#22C55E' : '#94A3B8',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    background: isStepDone(i, store) ? '#22C55E' : '#E2E8F0',
                    marginBottom: 18,
                    transition: 'background 0.3s',
                  }} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Section header + inline tip — dark */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #1a3a5c', background: '#0d2d4a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#0A2540',
            border: '1px solid #1a3a5c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{currentStep.label}</h2>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b', marginTop: 1 }}>{currentStep.subtitle}</p>
          </div>
        </div>

        {/* Inline tip — amber left border, dark bg */}
        <div style={{
          marginTop: 10,
          padding: '7px 11px',
          background: '#0A2540',
          border: '1px solid #0d2d4a',
          borderRadius: 7,
          borderLeft: '3px solid #f59e0b',
        }}>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            {currentStep.tip}
          </p>
        </div>
      </div>

      {/* Section content — fundo claro para os form cards */}
      <style>{`
        @keyframes fadeSection { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div key={step} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', background: '#F5F7FA', animation: 'fadeSection 0.25s ease' }}>
        {step === 0 && <PersonalSection />}
        {step === 1 && <ExperienceSection />}
        {step === 2 && <EducationSection />}
        {step === 3 && <SkillsSection />}
        {step === 4 && (
          <>
            <SummarySection />
            {/* Vagas — só aparece quando o resumo está preenchido */}
            {cvDone && <JobsBanner jobTitle={store.personal.jobTitle} />}
          </>
        )}
      </div>

      {/* Navigation footer — dark */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #1a3a5c',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0A2540',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'transparent',
            border: '1px solid #1a3a5c',
            borderRadius: 8,
            color: step === 0 ? '#1a3a5c' : '#94a3b8',
            fontSize: 13,
            fontWeight: 600,
            cursor: step === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronLeft size={15} />
          Anterior
        </button>

        <span style={{ fontSize: 11, color: '#1a3a5c', fontWeight: 500 }}>
          {step + 1} / {totalSteps}
        </span>

        {!isLastStep ? (
          <button
            type="button"
            onClick={() => setStep(s => Math.min(totalSteps - 1, s + 1))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              background: '#1E40AF',
              border: 'none',
              borderRadius: 10,
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(30,64,175,0.25)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1E40AF')}
          >
            Seguinte
            <ChevronRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              background: cvDone
                ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                : '#F1F5F9',
              border: 'none',
              borderRadius: 10,
              color: cvDone ? '#FFFFFF' : '#94A3B8',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'default',
              boxShadow: cvDone ? '0 2px 8px rgba(34,197,94,0.3)' : 'none',
              transition: 'all 0.3s',
            }}
          >
            <Check size={15} />
            {cvDone ? 'CV Completo!' : 'Escreve o resumo…'}
          </button>
        )}
      </div>
    </div>
  )
}
