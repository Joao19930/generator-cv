import React, { useRef, useState, useEffect } from 'react'
import { useCVStore } from '../../store/cvStore'
import TemplateRenderer from './templates/TemplateRenderer'

const COLORS = [
  { hex: '#b5a48a', label: 'Ivory' },
  { hex: '#1e3a5f', label: 'Navy' },
  { hex: '#2d4a2d', label: 'Forest' },
  { hex: '#4a1a1a', label: 'Bordeaux' },
]

type TemplateOption = {
  id: 'executive' | 'modern' | 'classic'
  label: string
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'executive', label: 'Executivo' },
  { id: 'modern', label: 'Moderno' },
  { id: 'classic', label: 'ATS' },
]

const ZOOM_OPTIONS: { value: number; label: string }[] = [
  { value: 0.75, label: '75%' },
  { value: 1.0, label: '100%' },
]

export default function PreviewPanel() {
  const store = useCVStore()
  const { zoom, setZoom, template, setTemplate, primaryColor, setPrimaryColor } = store
  const paperRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    if (!paperRef.current) return
    const obs = new ResizeObserver(() => {
      if (paperRef.current) {
        const h = paperRef.current.scrollHeight
        setPageCount(Math.max(1, Math.ceil(h / 1123)))
      }
    })
    obs.observe(paperRef.current)
    return () => obs.disconnect()
  }, [])

  const subToolbarBtnBase: React.CSSProperties = {
    padding: '4px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: '1px solid #E1DFDD',
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#EDEBE9',
      overflow: 'hidden',
    }}>
      {/* Sub-toolbar */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E1DFDD',
        height: 44,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {/* Group 1 — Templates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {TEMPLATE_OPTIONS.map(opt => {
            const active = template === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTemplate(opt.id)}
                style={{
                  ...subToolbarBtnBase,
                  background: active ? '#f59e0b' : '#FAF9F8',
                  color: active ? '#fff' : '#605E5C',
                  borderColor: active ? '#f59e0b' : '#E1DFDD',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Group 2 — Color swatches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {COLORS.map(c => {
            const active = primaryColor === c.hex
            return (
              <div
                key={c.hex}
                onClick={() => setPrimaryColor(c.hex)}
                title={c.label}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: c.hex,
                  cursor: 'pointer',
                  boxShadow: active
                    ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}`
                    : 'none',
                  transition: 'box-shadow 0.15s',
                  flexShrink: 0,
                }}
              />
            )
          })}
        </div>

        {/* Group 3 — Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {ZOOM_OPTIONS.map(opt => {
            const active = Math.abs(zoom - opt.value) < 0.01
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setZoom(opt.value)}
                style={{
                  ...subToolbarBtnBase,
                  background: active ? '#f59e0b' : '#FAF9F8',
                  color: active ? '#fff' : '#605E5C',
                  borderColor: active ? '#f59e0b' : '#E1DFDD',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingTop: 24,
        paddingLeft: 20,
      }}>
        {/* Paper container */}
        <div style={{
          width: 794 * zoom,
          flexShrink: 0,
          marginBottom: 80,
          position: 'relative',
        }}>
          {/* Scaler wrapper */}
          <div style={{
            transformOrigin: 'top center',
            transform: `scale(${zoom})`,
            width: 794,
            marginLeft: zoom < 1 ? -(794 * (1 - zoom)) / 2 : 0,
          }}>
            {/* Paper */}
            <div
              id="cv-preview-paper"
              ref={paperRef}
              style={{
                width: 794,
                minHeight: 1123,
                background: '#fff',
                boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <TemplateRenderer />
            </div>
          </div>
        </div>
      </div>

      {/* Page count indicator */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 204,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #E1DFDD',
        borderRadius: 8,
        padding: '4px 10px',
        fontSize: 11,
        color: '#8A8886',
        backdropFilter: 'blur(8px)',
        zIndex: 40,
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        Página 1 de {pageCount}
      </div>
    </div>
  )
}
