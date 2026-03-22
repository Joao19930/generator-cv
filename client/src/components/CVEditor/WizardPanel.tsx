import React, { useState } from 'react'
import { User, Briefcase, GraduationCap, Zap, FileText, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import PersonalSection from './sections/PersonalSection'
import ExperienceSection from './sections/ExperienceSection'
import EducationSection from './sections/EducationSection'
import SkillsSection from './sections/SkillsSection'
import SummarySection from './sections/SummarySection'
import { useCVStore } from '../../store/cvStore'

const STEPS = [
  { key: 'personal',    label: 'Info Pessoal',   subtitle: 'Nome, contacto e foto', icon: User },
  { key: 'experience',  label: 'Experiência',    subtitle: 'Historial profissional',  icon: Briefcase },
  { key: 'education',   label: 'Educação',       subtitle: 'Formação académica',     icon: GraduationCap },
  { key: 'skills',      label: 'Competências',   subtitle: 'Habilidades e nível',    icon: Zap },
  { key: 'summary',     label: 'Resumo',         subtitle: 'Apresentação profissional', icon: FileText },
] as const

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

export default function WizardPanel() {
  const [step, setStep] = useState(0)
  const store = useCVStore()
  const progress = calcProgress(store)
  const totalSteps = STEPS.length
  const currentStep = STEPS[step]
  const Icon = currentStep.icon

  function isStepDone(i: number): boolean {
    if (i === 0) return !!(store.personal.fullName && store.personal.email)
    if (i === 1) return store.experience.length > 0
    if (i === 2) return store.education.length > 0
    if (i === 3) return store.skills.length >= 2
    if (i === 4) return store.summary.length > 30
    return false
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FFFFFF' }}>

      {/* Step indicators */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #F1F5F9',
        background: '#FAFBFC',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {STEPS.map((s, i) => {
            const done = isStepDone(i)
            const active = i === step
            const StepIcon = s.icon
            return (
              <React.Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 2px',
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? '#1E40AF' : done ? '#22C55E' : '#F1F5F9',
                    border: active ? '2px solid #1E40AF' : done ? '2px solid #22C55E' : '2px solid #E2E8F0',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}>
                    {done && !active
                      ? <Check size={16} style={{ color: '#FFFFFF' }} />
                      : <StepIcon size={16} style={{ color: active ? '#FFFFFF' : '#94A3B8' }} />
                    }
                  </div>
                  <span style={{
                    fontSize: 10,
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
                    background: isStepDone(i) ? '#22C55E' : '#E2E8F0',
                    marginBottom: 18,
                    transition: 'background 0.3s',
                  }} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Section header */}
      <div style={{
        padding: '20px 24px 12px',
        borderBottom: '1px solid #F1F5F9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={20} style={{ color: '#1E40AF' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{currentStep.label}</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{currentStep.subtitle}</p>
          </div>
        </div>

        {/* ATS hint after 50% */}
        {progress >= 50 && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>🎯</span>
            <span style={{ fontSize: 12, color: '#15803D', fontWeight: 500 }}>
              CV {progress}% completo — está a superar {Math.round(progress * 0.7)}% dos candidatos
            </span>
          </div>
        )}
      </div>

      {/* Section content — scrollable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>
        {step === 0 && <PersonalSection />}
        {step === 1 && <ExperienceSection />}
        {step === 2 && <EducationSection />}
        {step === 3 && <SkillsSection />}
        {step === 4 && <SummarySection />}
      </div>

      {/* Navigation footer */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid #F1F5F9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#FAFBFC',
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
            padding: '10px 18px',
            background: step === 0 ? '#F8FAFC' : '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            color: step === 0 ? '#CBD5E1' : '#64748B',
            fontSize: 14,
            fontWeight: 600,
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <ChevronLeft size={16} />
          Anterior
        </button>

        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>
          {step + 1} / {totalSteps}
        </span>

        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => Math.min(totalSteps - 1, s + 1))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 18px',
              background: '#1E40AF',
              border: 'none',
              borderRadius: 10,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(30,64,175,0.25)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1E40AF')}
          >
            Seguinte
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #22C55E, #16A34A)',
              border: 'none',
              borderRadius: 10,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
            }}
          >
            <Check size={16} />
            CV Completo!
          </button>
        )}
      </div>
    </div>
  )
}
