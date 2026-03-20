import React, { useRef, useState, useEffect } from 'react'
import { useCVStore } from '../../store/cvStore'
import TemplateRenderer from './templates/TemplateRenderer'
import Toolbar from './Toolbar'

const ZOOM_LEVELS = [0.5, 0.75, 0.85, 1.0, 1.25]
const ZOOM_LABELS = ['50%', '75%', '85%', '100%', '125%']

export default function RightPanel() {
  const { zoom, setZoom } = useCVStore()
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

  return (
    <div
      style={{
        flex: 1,
        background: '#0f172a',
        overflow: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Zoom controls */}
      <div
        style={{
          position: 'sticky',
          top: 12,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 10,
          padding: '4px 6px',
          marginTop: 12,
          alignSelf: 'flex-end',
          marginRight: 20,
        }}
      >
        {ZOOM_LEVELS.map((z, i) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            style={{
              padding: '3px 9px',
              background: Math.abs(zoom - z) < 0.01 ? '#334155' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: Math.abs(zoom - z) < 0.01 ? '#f8fafc' : '#64748b',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {ZOOM_LABELS[i]}
          </button>
        ))}
      </div>

      {/* Paper scaler */}
      <div
        style={{
          width: 794 * zoom,
          marginTop: 20,
          marginBottom: 80,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            transformOrigin: 'top center',
            transform: `scale(${zoom})`,
            width: 794,
            marginLeft: zoom < 1 ? -(794 * (1 - zoom)) / 2 : 0,
          }}
        >
          <div
            id="cv-preview-paper"
            ref={paperRef}
            style={{
              width: 794,
              minHeight: 1123,
              background: '#fff',
              boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <TemplateRenderer />
          </div>
        </div>
      </div>

      {/* Page indicator */}
      <div
        style={{
          position: 'fixed',
          bottom: 80,
          right: 24,
          background: 'rgba(30,41,59,0.85)',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 11,
          color: '#64748b',
          backdropFilter: 'blur(8px)',
        }}
      >
        Página 1 de {pageCount}
      </div>

      {/* Bottom toolbar */}
      <Toolbar />
    </div>
  )
}
