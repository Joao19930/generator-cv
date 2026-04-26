import { useEffect, useState, useCallback } from 'react'
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

function getATSHints(store: ReturnType<typeof useCVStore.getState>): { pts: number; label: string }[] {
  const hints: { pts: number; label: string }[] = []
  if (!store.personal.jobTitle) hints.push({ pts: 15, label: 'Adicionar cargo profissional' })
  if (!store.summary || store.summary.length <= 100) hints.push({ pts: 15, label: 'Melhorar o resumo (mín. 100 chars)' })
  if (store.skills.length < 5) hints.push({ pts: 20, label: `Adicionar ${Math.max(0, 5 - store.skills.length)} competências` })
  if (store.experience.length === 0) hints.push({ pts: 20, label: 'Adicionar experiência profissional' })
  if (!(store.personal.email && store.personal.phone && store.personal.address)) hints.push({ pts: 15, label: 'Completar email, telefone e morada' })
  if (store.education.length === 0) hints.push({ pts: 10, label: 'Adicionar formação académica' })
  if (!store.personal.linkedin) hints.push({ pts: 5, label: 'Incluir perfil LinkedIn' })
  // Mostrar apenas os 3 com mais impacto
  return hints.sort((a, b) => b.pts - a.pts).slice(0, 3)
}

function ATSBadge({ store }: { store: ReturnType<typeof useCVStore.getState> }) {
  const [open, setOpen] = useState(false)
  const score = calcATS(store)
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const hints = getATSHints(store)

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Badge — clicável */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 9px',
          background: open ? '#F3F2F1' : '#FAF9F8',
          border: `1px solid ${open ? color + '60' : '#E1DFDD'}`,
          borderRadius: 20,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.02em' }}>ATS {score}</span>
        <span style={{ fontSize: 10, color: '#8A8886', marginLeft: 1 }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 230,
            background: '#FFFFFF',
            border: '1px solid #E1DFDD',
            borderRadius: 12,
            padding: '12px 14px',
            zIndex: 99,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
            {/* Seta */}
            <div style={{
              position: 'absolute',
              top: -5,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 9,
              height: 9,
              background: '#FFFFFF',
              border: '1px solid #E1DFDD',
              borderBottom: 'none',
              borderRight: 'none',
            }} />

            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#8A8886', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Como subir o score
            </p>

            {hints.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14 }}>🏆</span>
                <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>CV totalmente optimizado!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {hints.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 10px',
                    background: '#FAF9F8',
                    borderRadius: 8,
                    border: '1px solid #EDEBE9',
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#22c55e',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      +{h.pts}pts
                    </span>
                    <span style={{ fontSize: 11, color: '#605E5C', lineHeight: 1.4 }}>{h.label}</span>
                  </div>
                ))}
              </div>
            )}

            <p style={{ margin: '10px 0 0', fontSize: 10, color: '#8A8886', textAlign: 'center' }}>
              Score actual: <strong style={{ color }}>{score}/100</strong>
            </p>
          </div>
        </>
      )}
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

const STORAGE_KEY = 'cv_editor_data'

export default function CVEditor({ cvId = null, token = null, isPremium = false }: CVEditorProps) {
  const store = useCVStore()
  const [currentCvId, setCurrentCvId] = useState<string | null>(cvId)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [showMobilePreview, setShowMobilePreview] = useState(false)

  const handleSaved = useCallback(() => setSavedAt(new Date()), [])
  useAutosave(currentCvId, token, handleSaved)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    if (cvId && token) {
      // Editar CV existente — carrega da API
      fetch(`/api/cv/${cvId}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (!controller.signal.aborted && data) store.loadFromData(data) })
        .catch(err => { if (err.name !== 'AbortError') store.loadFromStorage() })
    } else if (token) {
      // Sem cvId na URL: verificar se há rascunho em progresso no localStorage
      let savedId: string | null = null
      let savedTitle = 'O meu CV'
      let savedTemplate = 'executive'
      let savedContentJson: Record<string, unknown> = {}
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          savedId       = parsed.id     ? String(parsed.id) : null
          savedTitle    = parsed.title    || savedTitle
          savedTemplate = parsed.template || savedTemplate
          savedContentJson = parsed
        }
      } catch {}

      if (savedId) {
        // Retomar rascunho no mesmo dispositivo — localStorage é sempre mais recente que a API
        store.loadFromStorage()
        setCurrentCvId(savedId)
        window.history.replaceState(null, '', `/editor?cv=${savedId}`)
        // Não faz fetch da API: localStorage já tem o estado mais actual
      } else {
        // Criar novo rascunho com o conteúdo de localStorage (se existir)
        store.loadFromStorage()
        fetch('/api/cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: savedTitle,
            templateName: savedTemplate,
            contentJson: savedContentJson,
            status: 'draft',
          }),
          signal: controller.signal,
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (controller.signal.aborted || !data?.id) return
            const newId = String(data.id)
            setCurrentCvId(newId)
            window.history.replaceState(null, '', `/editor?cv=${newId}`)
          })
          .catch(() => {})
      }
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[CVEditor] exportPDF error:', msg)
      toast.error('Erro ao exportar PDF: ' + msg)
    }
    finally { setExporting(false) }
  }

  const progress = calcProgress(store)

  function formatTime(d: Date) {
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  /* ── MOBILE LAYOUT ─────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div style={{ height: '100dvh', overflow: 'hidden', background: '#FAF9F8', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
          @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        `}</style>

        {/* Wizard ocupa tudo */}
        <WizardPanel isMobile onShowPreview={() => setShowMobilePreview(true)} />

        {/* Preview overlay — desliza de baixo */}
        {showMobilePreview && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', flexDirection: 'column',
            background: '#EDEBE9',
            animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
          }}>
            {/* Barra topo */}
            <div style={{
              height: 54, background: '#FFFFFF',
              borderBottom: '1px solid #E1DFDD',
              display: 'flex', alignItems: 'center',
              padding: '0 16px', gap: 12,
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            }}>
              <button
                type="button"
                onClick={() => setShowMobilePreview(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none',
                  color: '#605E5C', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  padding: '6px 0',
                }}
              >
                <Check size={14} style={{ transform: 'rotate(180deg)' }} />
                Voltar
              </button>

              <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#201F1E' }}>
                CV<span style={{ color: '#f59e0b' }}>Premium</span>
              </span>

              <button
                type="button"
                onClick={handleDownload}
                disabled={exporting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px',
                  background: isPremium ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#F3F2F1',
                  border: isPremium ? 'none' : '1px solid #E1DFDD',
                  borderRadius: 8,
                  color: isPremium ? '#fff' : '#605E5C',
                  fontSize: 12, fontWeight: 700,
                  cursor: exporting ? 'wait' : 'pointer',
                  opacity: exporting ? 0.7 : 1,
                  boxShadow: isPremium ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                }}
              >
                {isPremium ? <Download size={13} /> : <Lock size={13} />}
                PDF
              </button>
            </div>

            {/* Preview scrollável */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <PreviewPanel />
            </div>
          </div>
        )}

        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      </div>
    )
  }

  /* ── DESKTOP LAYOUT ────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#FAF9F8', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* HEADER */}
      <header style={{
        height: 52,
        background: '#FFFFFF',
        borderBottom: '1px solid #E1DFDD',
        display: 'flex', alignItems: 'center',
        gap: 14, padding: '0 18px',
        flexShrink: 0, zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <a href="/app" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#201F1E', letterSpacing: '-0.02em' }}>
            CV<span style={{ color: '#f59e0b' }}>Premium</span>
          </span>
        </a>

        <div style={{ width: 1, height: 18, background: '#E1DFDD', flexShrink: 0 }} />

        <input
          value={store.title}
          onChange={e => store.setTitle(e.target.value)}
          style={{
            background: 'transparent', border: '1px solid transparent',
            borderRadius: 6, padding: '4px 8px',
            color: '#8A8886', fontSize: 13, fontWeight: 500,
            outline: 'none', minWidth: 80, maxWidth: 180,
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#E1DFDD'; (e.target as HTMLInputElement).style.color = '#201F1E' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; (e.target as HTMLInputElement).style.color = '#8A8886' }}
        />

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 4, background: '#EDEBE9', borderRadius: 2, overflow: 'hidden', maxWidth: 160 }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: progress < 40 ? '#ef4444' : progress < 70 ? '#f59e0b' : '#22c55e',
              borderRadius: 2, transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#605E5C', flexShrink: 0 }}>{progress}%</span>
          <ATSBadge store={store} />
        </div>

        {savedAt ? (
          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={12} /> {formatTime(savedAt)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#8A8886', flexShrink: 0 }}>Não guardado</span>
        )}

        <div style={{ width: 1, height: 18, background: '#E1DFDD', flexShrink: 0 }} />

        <button
          type="button"
          onClick={handleDownload}
          disabled={exporting}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: isPremium ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#F3F2F1',
            border: isPremium ? 'none' : '1px solid #E1DFDD',
            borderRadius: 8,
            color: isPremium ? '#fff' : '#605E5C',
            fontSize: 12, fontWeight: 700,
            cursor: exporting ? 'wait' : 'pointer',
            opacity: exporting ? 0.7 : 1,
            flexShrink: 0,
            boxShadow: isPremium ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
          }}
        >
          {isPremium ? <Download size={13} /> : <Lock size={13} />}
          {exporting ? 'A exportar...' : 'PDF'}
        </button>

        <button
          type="button"
          onClick={() => { window.location.href = '/app' }}
          style={{
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid #E1DFDD',
            borderRadius: 7, color: '#8A8886', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </header>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 520, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#FFFFFF', boxShadow: '2px 0 8px rgba(0,0,0,0.06)' }}>
          <WizardPanel />
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#EDEBE9' }}>
          <PreviewPanel />
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
