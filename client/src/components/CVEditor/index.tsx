import React, { useEffect, useState, useCallback } from 'react'
import { Download, Lock, X, Check } from 'lucide-react'
import { useCVStore } from '../../store/cvStore'
import { useAutosave } from '../../hooks/useAutosave'
import { exportPDF } from '../../utils/exportPDF'
import WizardPanel from './WizardPanel'
import PreviewPanel from './PreviewPanel'
import UpgradeModal from './UpgradeModal'
import toast from 'react-hot-toast'

interface CVEditorProps {
  cvId?: string | null
  token?: string | null
  isPremium?: boolean
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

function ATSBadge({ store }: { store: ReturnType<typeof useCVStore.getState> }) {
  const score = calcATS(store)
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        background: '#1e293b',
        border: `1px solid #334155`,
        borderRadius: 20,
        flexShrink: 0,
        cursor: 'default',
      }}
      title={`Score ATS: ${score}/100 — ${score >= 70 ? 'CV bem optimizado' : score >= 40 ? 'Adicione mais detalhes' : 'Preencha mais secções'}`}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.02em' }}>ATS {score}</span>
    </div>
  )
}

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

export default function CVEditor({ cvId = null, token = null, isPremium = false }: CVEditorProps) {
  const store = useCVStore()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const handleSaved = useCallback(() => setSavedAt(new Date()), [])
  useAutosave(cvId, token, handleSaved)

  useEffect(() => {
    const controller = new AbortController()
    if (cvId && token) {
      fetch(`/api/cv/${cvId}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (!controller.signal.aborted && data) store.loadFromData(data) })
        .catch(err => { if (err.name !== 'AbortError') store.loadFromStorage() })
    } else {
      store.loadFromStorage()
    }
    return () => controller.abort()
  }, [cvId, token])

  async function handleDownload() {
    if (!isPremium) { setShowUpgrade(true); return }
    setExporting(true)
    try {
      await exportPDF('cv-preview-paper', store.title || 'cv')
      toast.success('PDF exportado com sucesso!')
    } catch { toast.error('Erro ao exportar PDF') }
    finally { setExporting(false) }
  }

  const progress = calcProgress(store)

  function formatTime(d: Date) {
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* HEADER — dark */}
      <header style={{
        height: 52,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 18px',
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <a href="/app" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            CV<span style={{ color: '#f59e0b' }}>Premium</span>
          </span>
        </a>

        <div style={{ width: 1, height: 18, background: '#1e293b', flexShrink: 0 }} />

        {/* Title */}
        <input
          value={store.title}
          onChange={e => store.setTitle(e.target.value)}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            padding: '4px 8px',
            color: '#64748b',
            fontSize: 13,
            fontWeight: 500,
            outline: 'none',
            minWidth: 80,
            maxWidth: 180,
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#334155'; (e.target as HTMLInputElement).style.color = '#e2e8f0' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; (e.target as HTMLInputElement).style.color = '#64748b' }}
        />

        {/* Progress + ATS badge */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden', maxWidth: 160 }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: progress < 40 ? '#ef4444' : progress < 70 ? '#f59e0b' : '#22c55e',
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', flexShrink: 0 }}>{progress}%</span>
          <ATSBadge store={store} />
        </div>

        {/* Save status */}
        {savedAt ? (
          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={12} /> {formatTime(savedAt)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>Não guardado</span>
        )}

        <div style={{ width: 1, height: 18, background: '#1e293b', flexShrink: 0 }} />

        {/* Download PDF */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={exporting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            background: isPremium ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#1e293b',
            border: isPremium ? 'none' : '1px solid #334155',
            borderRadius: 8,
            color: isPremium ? '#fff' : '#64748b',
            fontSize: 12,
            fontWeight: 700,
            cursor: exporting ? 'wait' : 'pointer',
            opacity: exporting ? 0.7 : 1,
            flexShrink: 0,
            boxShadow: isPremium ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
          }}
        >
          {isPremium ? <Download size={13} /> : <Lock size={13} />}
          {exporting ? 'A exportar...' : 'PDF'}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={() => { window.location.href = '/app' }}
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid #1e293b',
            borderRadius: 7,
            color: '#475569',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Wizard Left Panel — dark chrome */}
        <div style={{ width: 460, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#1e293b', borderRight: '1px solid #334155' }}>
          <WizardPanel />
        </div>

        {/* Preview Right — branco puro */}
        <div style={{ flex: 1, overflow: 'auto', background: '#334155' }}>
          <PreviewPanel />
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
