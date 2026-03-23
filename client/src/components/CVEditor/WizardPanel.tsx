import React, { useState, useEffect } from 'react'
import { User, Briefcase, GraduationCap, Zap, FileText, Globe, ChevronRight, ChevronLeft, Check, ExternalLink, MapPin, Building2 } from 'lucide-react'
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

type Job = {
  id: number
  title: string
  company: string
  city: string
  country: string
  url: string
  salary?: string
}

function MatchingJobs({ jobTitle }: { jobTitle: string }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')

  useEffect(() => {
    const q = jobTitle.trim()
    if (!q || q === searched) return
    setLoading(true)
    setSearched(q)
    fetch(`/api/empregos?search=${encodeURIComponent(q)}&limit=3`)
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => setJobs(d.jobs || []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [jobTitle])

  if (!jobTitle.trim()) return null

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 15 }}>🎯</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Vagas compatíveis</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>para {jobTitle}</span>
        </div>
        <a
          href={`/empregos?search=${encodeURIComponent(jobTitle)}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: '#1E40AF', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
        >
          Ver todas <ExternalLink size={10} />
        </a>
      </div>

      {/* Skeletons */}
      {loading && [0,1,2].map(i => (
        <div key={i} style={{
          height: 64, background: '#F1F5F9', borderRadius: 10, marginBottom: 8,
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      ))}

      {/* Empty */}
      {!loading && jobs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '14px 0', color: '#94A3B8', fontSize: 12 }}>
          Sem vagas encontradas para esta função.{' '}
          <a href="/empregos" target="_blank" rel="noreferrer" style={{ color: '#1E40AF' }}>Ver todas as vagas →</a>
        </div>
      )}

      {/* Job cards */}
      {!loading && jobs.map(job => (
        <div key={job.id} style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {/* Icon */}
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Briefcase size={14} color="#1E40AF" />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {job.title}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#64748B' }}>
                <Building2 size={9} /> {job.company || 'Empresa'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#64748B' }}>
                <MapPin size={9} /> {job.city || job.country || 'Angola'}
              </span>
              {job.salary && (
                <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>{job.salary}</span>
              )}
            </div>
          </div>

          {/* Apply button */}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            style={{
              flexShrink: 0,
              padding: '5px 10px',
              background: 'linear-gradient(135deg,#1E40AF,#1D4ED8)',
              borderRadius: 7,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Aplicar <ExternalLink size={9} />
          </a>
        </div>
      ))}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}

interface WizardPanelProps {
  isMobile?: boolean
  onShowPreview?: () => void
}

export default function WizardPanel({ isMobile = false, onShowPreview }: WizardPanelProps) {
  const [step, setStep] = useState(0)
  const store = useCVStore()
  const totalSteps = STEPS.length
  const currentStep = STEPS[step]
  const Icon = currentStep.icon
  const isLastStep = step === totalSteps - 1
  const cvDone = isLastStep && isStepDone(5, store)

  const StepContent = () => (
    <>
      {step === 0 && <PersonalSection />}
      {step === 1 && <ExperienceSection />}
      {step === 2 && <EducationSection />}
      {step === 3 && <SkillsSection />}
      {step === 4 && <LanguagesSection />}
      {step === 5 && (
        <>
          <SummarySection />
          <MatchingJobs jobTitle={store.personal.jobTitle} />
        </>
      )}
    </>
  )

  /* ══════════════════════════════════════════════════════════
     MOBILE — Experiência passo a passo imersiva
  ══════════════════════════════════════════════════════════ */
  if (isMobile) {
    const pct = Math.round(((step + 1) / totalSteps) * 100)
    const stepsDone = STEPS.filter((_, i) => isStepDone(i, store)).length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FFFFFF', overflow: 'hidden' }}>
        <style>{`
          @keyframes mFade { from { opacity:0; transform:translateX(16px) } to { opacity:1; transform:translateX(0) } }
          @keyframes mPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        `}</style>

        {/* ── HEADER MOBILE ── */}
        <div style={{
          flexShrink: 0,
          background: '#FFFFFF',
          borderBottom: '1px solid #F3F2F1',
          padding: '12px 20px 0',
        }}>
          {/* Logo + fechar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <a href="/app" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#201F1E', letterSpacing: '-0.02em' }}>
                CV<span style={{ color: '#f59e0b' }}>Premium</span>
              </span>
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8A8886' }}>
                {stepsDone}/{totalSteps} concluídos
              </span>
              <a href="/app" style={{
                width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #E1DFDD', borderRadius: 8, color: '#8A8886', textDecoration: 'none',
              }}>
                <X size={14} />
              </a>
            </div>
          </div>

          {/* Barra de progresso segmentada */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
            {STEPS.map((_, i) => {
              const done = isStepDone(i, store)
              const active = i === step
              return (
                <div
                  key={i}
                  onClick={() => setStep(i)}
                  style={{
                    flex: 1, height: 4, borderRadius: 4, cursor: 'pointer',
                    background: done ? '#22c55e' : active ? '#f59e0b' : '#EDEBE9',
                    transition: 'background 0.3s',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* ── CARD DO PASSO ACTUAL ── */}
        <div style={{
          flexShrink: 0,
          padding: '20px 20px 0',
          background: '#FFFFFF',
        }}>
          <div
            key={step}
            style={{ animation: 'mFade 0.25s ease' }}
          >
            {/* Ícone + info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: isStepDone(step, store)
                  ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)'
                  : 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                {isStepDone(step, store)
                  ? <Check size={22} color="#16a34a" />
                  : <Icon size={22} color="#f59e0b" />
                }
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#201F1E', letterSpacing: '-0.02em' }}>
                    {currentStep.label}
                  </h2>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px',
                    borderRadius: 20, background: '#F3F2F1', color: '#8A8886',
                  }}>
                    {step + 1} / {totalSteps}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#8A8886' }}>
                  {currentStep.subtitle}
                </p>
              </div>
            </div>

            {/* Dica */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '9px 12px',
              background: '#FFFBEB', borderRadius: 10,
              border: '1px solid #FEF3C7',
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                {currentStep.tip}
              </p>
            </div>
          </div>
        </div>

        {/* ── FORMULÁRIO SCROLLÁVEL ── */}
        <div
          key={`content-${step}`}
          style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            padding: '0 20px 20px',
            background: '#FAF9F8',
            borderTop: '1px solid #F3F2F1',
            animation: 'mFade 0.25s ease',
          }}
        >
          <div style={{ paddingTop: 16 }}>
            <StepContent />
          </div>
        </div>

        {/* ── RODAPÉ MOBILE ── */}
        <div style={{
          flexShrink: 0,
          background: '#FFFFFF',
          borderTop: '1px solid #E1DFDD',
          padding: '12px 20px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}>
          {/* Botão "Ver o meu CV" — aparece quando completo */}
          {cvDone && (
            <button
              type="button"
              onClick={onShowPreview}
              style={{
                width: '100%', marginBottom: 10,
                padding: '14px 0',
                background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                border: 'none', borderRadius: 14,
                color: '#fff', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', letterSpacing: '-0.01em',
                boxShadow: '0 4px 16px rgba(245,158,11,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              ✨ Ver o meu CV
            </button>
          )}

          {/* Nav Anterior / Seguinte */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              style={{
                flex: step === 0 ? 0 : 1,
                padding: '12px 0',
                background: step === 0 ? 'transparent' : '#F3F2F1',
                border: 'none', borderRadius: 12,
                color: '#605E5C', fontSize: 14, fontWeight: 700,
                cursor: step === 0 ? 'default' : 'pointer',
                display: step === 0 ? 'none' : 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'opacity 0.2s',
              }}
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            {!isLastStep ? (
              <button
                type="button"
                onClick={() => setStep(s => Math.min(totalSteps - 1, s + 1))}
                style={{
                  flex: 1, padding: '12px 0',
                  background: 'linear-gradient(135deg,#1E40AF,#1D4ED8)',
                  border: 'none', borderRadius: 12,
                  color: '#fff', fontSize: 14, fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 3px 12px rgba(30,64,175,0.3)',
                }}
              >
                Seguinte <ChevronRight size={16} />
              </button>
            ) : (
              !cvDone && (
                <div style={{
                  flex: 1, padding: '12px 0',
                  background: '#F3F2F1', borderRadius: 12,
                  color: '#A19F9D', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Check size={14} /> Preenche o resumo...
                </div>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════
     DESKTOP — Layout compacto lateral (original)
  ══════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FFFFFF' }}>
      <style>{`
        @keyframes fadeSection { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── TOPO COMPACTO ──────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #E1DFDD' }}>

        {/* Linha 1 — Steps horizontais */}
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
                    : <StepIcon size={11} style={{ color: active ? '#f59e0b' : '#8A8886', flexShrink: 0 }} />
                  }
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    color: active ? '#f59e0b' : done ? '#22c55e' : '#8A8886',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: isStepDone(i, store) ? '#22c55e' : '#EDEBE9', minWidth: 8, maxWidth: 28 }} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Linha 2 — Título + tip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 16px', height: 28,
          borderTop: '1px solid #F3F2F1',
          background: '#FAFAF9',
        }}>
          <Icon size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#201F1E', whiteSpace: 'nowrap' }}>{currentStep.label}</span>
          <span style={{ fontSize: 10, color: '#8A8886', whiteSpace: 'nowrap' }}>—</span>
          <span style={{ fontSize: 10, color: '#8A8886', whiteSpace: 'nowrap' }}>{currentStep.subtitle}</span>
          <div style={{ width: 1, height: 14, background: '#E1DFDD', flexShrink: 0, margin: '0 2px' }} />
          <span style={{ fontSize: 10, color: '#A19F9D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            💡 {currentStep.tip}
          </span>
        </div>
      </div>

      {/* ── CONTEÚDO ──────────────────────────────────────── */}
      <div
        key={step}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '16px 16px 0',
          background: '#F8F7F6',
          animation: 'fadeSection 0.2s ease',
        }}
      >
        <StepContent />
      </div>

      {/* ── RODAPÉ ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 38,
        borderTop: '1px solid #E1DFDD',
        background: '#FFFFFF', flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none',
            color: step === 0 ? '#EDEBE9' : '#8A8886',
            fontSize: 11, fontWeight: 600,
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            padding: '4px 6px',
          }}
        >
          <ChevronLeft size={13} /> Anterior
        </button>

        <span style={{ fontSize: 10, color: '#A19F9D', fontWeight: 500, letterSpacing: '0.04em' }}>
          {step + 1} / {totalSteps}
        </span>

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
              background: cvDone ? 'linear-gradient(135deg,#22C55E,#16A34A)' : '#F3F2F1',
              border: 'none', borderRadius: 6,
              color: cvDone ? '#fff' : '#A19F9D',
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
