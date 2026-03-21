import React, { useEffect, useState, useCallback } from 'react'
import { Undo2, Redo2, Download, Share2, X, Lock } from 'lucide-react'
import { useCVStore } from '../../store/cvStore'
import { useAutosave } from '../../hooks/useAutosave'
import { exportPDF } from '../../utils/exportPDF'
import LeftPanel from './LeftPanel'
import PreviewPanel from './PreviewPanel'
import RightPanel from './RightPanel'
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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [leftWidth, setLeftWidth] = useState(320)
  const isDragging = React.useRef(false)
  const dragStart = React.useRef(0)
  const dragStartWidth = React.useRef(320)

  function onResizeMouseDown(e: React.MouseEvent) {
    isDragging.current = true
    dragStart.current = e.clientX
    dragStartWidth.current = leftWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev: MouseEvent) {
      if (!isDragging.current) return
      const delta = ev.clientX - dragStart.current
      setLeftWidth(Math.min(520, Math.max(220, dragStartWidth.current + delta)))
    }
    function onUp() {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleSaved = useCallback(() => {
    setSavedAt(new Date())
  }, [])

  useAutosave(cvId, token, handleSaved)

  useEffect(() => {
    function onResize() {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Load data on mount — AbortController evita que um fetch atrasado
  // sobrescreva o que o utilizador já escreveu (race condition / Strict Mode)
  useEffect(() => {
    const controller = new AbortController()

    if (cvId && token) {
      fetch(`/api/cv/${cvId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!controller.signal.aborted && data) store.loadFromData(data)
        })
        .catch(err => {
          if (err.name !== 'AbortError') store.loadFromStorage()
        })
    } else {
      store.loadFromStorage()
    }

    return () => controller.abort()
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
    } catch {
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

  const progress = calcProgress(store)
  const isMobile = windowWidth < 768

  function formatSavedTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  const sepStyle: React.CSSProperties = {
    width: 1,
    height: 20,
    background: '#1e293b',
    flexShrink: 0,
  }

  const iconBtnStyle = (disabled?: boolean): React.CSSProperties => ({
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid #1e293b',
    borderRadius: 7,
    color: disabled ? '#334155' : '#94a3b8',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0f172a' }}>
      {/* TOPBAR */}
      <header style={{
        height: 48,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <a href="/app" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            CV<span style={{ color: '#f59e0b' }}>Premium</span>
          </span>
        </a>

        <div style={sepStyle} />

        {/* Editable title */}
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
            minWidth: 100,
            maxWidth: 220,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#b5a48a' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'transparent' }}
        />

        <div style={sepStyle} />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => store.undo()}
          disabled={store.past.length === 0}
          title="Desfazer (Ctrl+Z)"
          style={iconBtnStyle(store.past.length === 0)}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={() => store.redo()}
          disabled={store.future.length === 0}
          title="Refazer (Ctrl+Y)"
          style={iconBtnStyle(store.future.length === 0)}
        >
          <Redo2 size={15} />
        </button>

        {/* Flex spacer */}
        <div style={{ flex: 1 }} />

        {/* Progress section */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Progresso</span>
          <div style={{
            width: 90,
            height: 4,
            background: '#1e293b',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: '#b5a48a',
              borderRadius: 2,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#b5a48a', fontWeight: 600, minWidth: 32 }}>{progress}%</span>
        </div>

        <div style={sepStyle} />

        {/* Saved badge */}
        {savedAt ? (
          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
            ✓ Guardado {formatSavedTime(savedAt)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#475569', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
            Não guardado
          </span>
        )}

        <div style={sepStyle} />

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          title="Partilhar"
          style={iconBtnStyle()}
        >
          <Share2 size={15} />
        </button>

        {/* Download PDF */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={exporting}
          title={isPremium ? 'Descarregar PDF' : 'Requer Premium'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: isPremium ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#1e293b',
            border: isPremium ? 'none' : '1px solid #334155',
            borderRadius: 8,
            color: isPremium ? '#fff' : '#64748b',
            fontSize: 12,
            cursor: exporting ? 'wait' : 'pointer',
            fontWeight: 600,
            opacity: exporting ? 0.7 : 1,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {isPremium ? <Download size={13} /> : <Lock size={13} />}
          {exporting ? 'A exportar...' : 'PDF'}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={() => { window.location.href = '/app' }}
          style={iconBtnStyle()}
          title="Fechar editor"
        >
          <X size={15} />
        </button>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LeftPanel — resizable */}
        <div style={{ width: leftWidth, flexShrink: 0, overflow: 'hidden' }}>
          <LeftPanel />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            width: 4,
            flexShrink: 0,
            background: '#1e293b',
            cursor: 'col-resize',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#b5a48a' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#1e293b' }}
        />

        {/* PreviewPanel — always visible */}
        <PreviewPanel />

        {/* RightPanel — hidden on mobile */}
        {!isMobile && (
          <div style={{ width: 180, flexShrink: 0, overflow: 'hidden' }}>
            <RightPanel />
          </div>
        )}
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
