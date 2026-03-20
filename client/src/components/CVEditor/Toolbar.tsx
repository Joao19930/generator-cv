import React, { useState, useRef, useEffect } from 'react'
import { useCVStore } from '../../store/cvStore'

const FONTS = ['Inter', 'Georgia', 'Merriweather', 'Roboto', 'Playfair Display']
const SIZES = [10, 11, 12, 13]
const SPACINGS = [
  { key: 'compact', label: 'Compacto' },
  { key: 'normal', label: 'Normal' },
  { key: 'spacious', label: 'Espaçoso' },
] as const

const COLORS = [
  { hex: '#1a2e4a', name: 'Navy' },
  { hex: '#334155', name: 'Slate' },
  { hex: '#1a3d2b', name: 'Forest' },
  { hex: '#6b1c2e', name: 'Burgundy' },
  { hex: '#92681a', name: 'Gold' },
  { hex: '#2d2d2d', name: 'Charcoal' },
  { hex: '#1e3a8a', name: 'Royal Blue' },
  { hex: '#065f46', name: 'Emerald' },
]

const TEMPLATES = [
  { key: 'executive', label: 'Executivo', desc: 'Clássico & Elegante' },
  { key: 'modern', label: 'Moderno', desc: 'Bicoluna Tech' },
  { key: 'classic', label: 'Clássico', desc: 'Máx. ATS' },
  { key: 'creative', label: 'Criativo', desc: 'Colorido & Fresco' },
] as const

type PopupType = 'font' | 'size' | 'spacing' | 'color' | 'template' | null

export default function Toolbar() {
  const store = useCVStore()
  const [open, setOpen] = useState<PopupType>(null)
  const [customColor, setCustomColor] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(type: PopupType) {
    setOpen(o => o === type ? null : type)
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? '#334155' : 'transparent',
    border: 'none',
    borderRadius: 8,
    color: active ? '#f8fafc' : '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'all 0.15s',
  })

  const popupBase: React.CSSProperties = {
    position: 'absolute',
    bottom: 'calc(100% + 10px)',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 200,
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 16,
        padding: '6px 10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 100,
      }}
    >
      {/* Font picker */}
      <div style={{ position: 'relative' }}>
        <button type="button" style={btnStyle(open === 'font')} onClick={() => toggle('font')} title="Tipo de letra">
          Aa
        </button>
        {open === 'font' && (
          <div style={{ ...popupBase, left: 0, minWidth: 180 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Tipo de letra</p>
            {FONTS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => { store.setFontFamily(f); setOpen(null) }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 10px',
                  background: store.fontFamily === f ? '#334155' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: store.fontFamily === f ? '#f8fafc' : '#94a3b8',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: f,
                  fontWeight: store.fontFamily === f ? 600 : 400,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Size picker */}
      <div style={{ position: 'relative' }}>
        <button type="button" style={btnStyle(open === 'size')} onClick={() => toggle('size')} title="Tamanho">
          <span style={{ fontSize: 11 }}>T</span><span style={{ fontSize: 14 }}>T</span>
        </button>
        {open === 'size' && (
          <div style={{ ...popupBase, left: 0, minWidth: 130 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Tamanho</p>
            {SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { store.setFontSize(s); setOpen(null) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '6px 10px',
                  background: store.fontSize === s ? '#334155' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: store.fontSize === s ? '#f8fafc' : '#94a3b8',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <span>{s}px</span>
                {store.fontSize === s && <span style={{ color: '#f59e0b', fontSize: 10 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spacing */}
      <div style={{ position: 'relative' }}>
        <button type="button" style={btnStyle(open === 'spacing')} onClick={() => toggle('spacing')} title="Espaçamento">
          ↕
        </button>
        {open === 'spacing' && (
          <div style={{ ...popupBase, left: 0, minWidth: 150 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Espaçamento</p>
            {SPACINGS.map(sp => (
              <button
                key={sp.key}
                type="button"
                onClick={() => { store.setLineSpacing(sp.key); setOpen(null) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '6px 10px',
                  background: store.lineSpacing === sp.key ? '#334155' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: store.lineSpacing === sp.key ? '#f8fafc' : '#94a3b8',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <span>{sp.label}</span>
                {store.lineSpacing === sp.key && <span style={{ color: '#f59e0b', fontSize: 10 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 24, background: '#334155', margin: '0 2px' }} />

      {/* Color picker */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => toggle('color')}
          title="Cor principal"
          style={{
            ...btnStyle(open === 'color'),
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 13 }}>🎨</span>
          <div style={{ width: 16, height: 3, background: store.primaryColor, borderRadius: 2 }} />
        </button>
        {open === 'color' && (
          <div style={{ ...popupBase, left: '50%', transform: 'translateX(-50%)', minWidth: 200 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Cor principal</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => { store.setPrimaryColor(c.hex); setOpen(null) }}
                  title={c.name}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: c.hex,
                    border: store.primaryColor === c.hex ? '2px solid #f59e0b' : '2px solid transparent',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>
            <div style={{ borderTop: '1px solid #334155', paddingTop: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Personalizado</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={customColor}
                  onChange={e => setCustomColor(e.target.value)}
                  placeholder="#000000"
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '5px 8px',
                    color: '#f8fafc',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => { if (/^#[0-9a-f]{6}$/i.test(customColor)) { store.setPrimaryColor(customColor); setOpen(null) } }}
                  style={{
                    padding: '5px 10px',
                    background: '#334155',
                    border: 'none',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template picker */}
      <div style={{ position: 'relative' }}>
        <button type="button" style={btnStyle(open === 'template')} onClick={() => toggle('template')} title="Template">
          📄
        </button>
        {open === 'template' && (
          <div style={{ ...popupBase, right: 0, minWidth: 260 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Template</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { store.setTemplate(t.key); setOpen(null) }}
                  style={{
                    padding: '10px 12px',
                    background: store.template === t.key ? `${store.primaryColor}20` : '#0f172a',
                    border: `2px solid ${store.template === t.key ? store.primaryColor : '#334155'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: store.template === t.key ? store.primaryColor : '#e2e8f0', marginBottom: 2 }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
