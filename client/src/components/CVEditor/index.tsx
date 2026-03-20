import React, { useEffect, useState } from 'react'
import { Undo2, Redo2, Download, Share2, X, Lock } from 'lucide-react'
import { useCVStore } from '../../store/cvStore'
import { useAutosave } from '../../hooks/useAutosave'
import { exportPDF } from '../../utils/exportPDF'
import LeftPanel from './LeftPanel'
import RightPanel from './RightPanel'
import UpgradeModal from './UpgradeModal'
import toast from 'react-hot-toast'

interface CVEditorProps {
  cvId?: string | null
  token?: string | null
  isPremium?: boolean
}

export default function CVEditor({ cvId = null, token = null, isPremium = false }: CVEditorProps) {
  const store = useCVStore()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Autosave hook
  useAutosave(cvId, token)

  // Load data on mount
  useEffect(() => {
    if (cvId && token) {
      fetch(`/api/cv/${cvId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) store.loadFromData(data) })
        .catch(() => store.loadFromStorage())
    } else {
      store.loadFromStorage()
    }
  }, [cvId, token])

  async function handleDownload() {
    if (!isPremium) {
      setShowUpgrade(true)
      return
    }
    setExporting(true)
    try {
      const filename = store.title || 'cv'
      await exportPDF('cv-preview-paper', filename)
      toast.success('PDF exportado com sucesso!')
    } catch (err) {
      toast.error('Erro ao exportar PDF')
    } finally {
      setExporting(false)
    }
  }

  function handleShare() {
    if (!cvId) {
      toast.error('Guarda o CV primeiro para partilhar')
      return
    }
    const url = `${window.location.origin}/preview?cv=${cvId}`
    navigator.clipboard?.writeText(url).then(() => {
      toast.success('Link copiado para a área de transferência!')
    }).catch(() => {
      toast.success(`Link: ${url}`)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0f172a' }}>
      {/* Topbar */}
      <header style={{
        height: 56,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Left: Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <a href="/app" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              CV<span style={{ color: '#f59e0b' }}>Premium</span>
            </span>
          </a>

          <div style={{ width: 1, height: 20, background: '#1e293b' }} />

          <input
            value={store.title}
            onChange={e => store.setTitle(e.target.value)}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 6,
              padding: '4px 8px',
              color: '#e2e8f0',
              fontSize: 14,
              fontWeight: 500,
              outline: 'none',
              minWidth: 120,
              maxWidth: 280,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#f59e0b')}
            onBlur={e => (e.target.style.borderColor = 'transparent')}
          />
        </div>

        {/* Center: Undo/Redo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => store.undo()}
            disabled={store.past.length === 0}
            title="Desfazer (Ctrl+Z)"
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid #1e293b',
              borderRadius: 7,
              color: store.past.length === 0 ? '#334155' : '#94a3b8',
              cursor: store.past.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => store.redo()}
            disabled={store.future.length === 0}
            title="Refazer (Ctrl+Y)"
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid #1e293b',
              borderRadius: 7,
              color: store.future.length === 0 ? '#334155' : '#94a3b8',
              cursor: store.future.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Redo2 size={15} />
          </button>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleShare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#94a3b8',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <Share2 size={14} />
            Partilhar
          </button>

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
              color: isPremium ? '#fff' : '#94a3b8',
              fontSize: 13,
              cursor: exporting ? 'wait' : 'pointer',
              fontWeight: 600,
              opacity: exporting ? 0.7 : 1,
            }}
          >
            {isPremium ? <Download size={14} /> : <Lock size={14} />}
            {exporting ? 'A exportar...' : 'Descarregar PDF'}
          </button>

          <button
            type="button"
            onClick={() => { window.location.href = '/app' }}
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid #1e293b',
              borderRadius: 7,
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LeftPanel />
        <RightPanel />
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
