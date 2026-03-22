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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#F5F7FA', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* HEADER */}
      <header style={{
        height: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 20px',
        flexShrink: 0,
        zIndex: 50,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <a href="/app" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em' }}>
            CV<span style={{ color: '#1E40AF' }}>Premium</span>
          </span>
        </a>

        <div style={{ width: 1, height: 20, background: '#E2E8F0', flexShrink: 0 }} />

        {/* Title */}
        <input
          value={store.title}
          onChange={e => store.setTitle(e.target.value)}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 6,
            padding: '4px 8px',
            color: '#64748B',
            fontSize: 13,
            fontWeight: 500,
            outline: 'none',
            minWidth: 80,
            maxWidth: 180,
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#E2E8F0'; (e.target as HTMLInputElement).style.color = '#1E293B' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; (e.target as HTMLInputElement).style.color = '#64748B' }}
        />

        {/* Progress */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', maxWidth: 200 }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: progress < 40 ? '#EF4444' : progress < 70 ? '#F59E0B' : '#22C55E',
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', flexShrink: 0 }}>{progress}%</span>
        </div>

        {/* Save status */}
        {savedAt ? (
          <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={13} /> Guardado {formatTime(savedAt)}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#94A3B8', flexShrink: 0 }}>Não guardado</span>
        )}

        <div style={{ width: 1, height: 20, background: '#E2E8F0', flexShrink: 0 }} />

        {/* Download PDF */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={exporting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: isPremium ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#F1F5F9',
            border: 'none',
            borderRadius: 10,
            color: isPremium ? '#FFFFFF' : '#94A3B8',
            fontSize: 13,
            fontWeight: 700,
            cursor: exporting ? 'wait' : 'pointer',
            opacity: exporting ? 0.7 : 1,
            flexShrink: 0,
            boxShadow: isPremium ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
          }}
        >
          {isPremium ? <Download size={14} /> : <Lock size={14} />}
          {exporting ? 'A exportar...' : 'Download PDF'}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={() => { window.location.href = '/app' }}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            color: '#94A3B8',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={15} />
        </button>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Wizard Left Panel */}
        <div style={{ width: 460, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRight: '1px solid #E2E8F0' }}>
          <WizardPanel />
        </div>

        {/* Preview Right */}
        <div style={{ flex: 1, overflow: 'auto', background: '#F5F7FA' }}>
          <PreviewPanel />
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
