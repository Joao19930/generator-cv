import React from 'react'
import { useCVStore } from '../../../store/cvStore'

interface CustomSectionProps {
  id: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#f8fafc',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s',
}

export default function CustomSectionEditor({ id }: CustomSectionProps) {
  const { customSections, updateCustomSection } = useCVStore()
  const section = customSections.find(s => s.id === id)

  if (!section) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{
          fontSize: 11, fontWeight: 600, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4
        }}>
          Título da secção
        </label>
        <input
          style={inputStyle}
          value={section.title}
          onChange={e => updateCustomSection(id, { title: e.target.value })}
          placeholder="Ex: Voluntariado, Publicações..."
          onFocus={e => (e.target.style.borderColor = '#f59e0b')}
          onBlur={e => (e.target.style.borderColor = '#334155')}
        />
      </div>
      <div>
        <label style={{
          fontSize: 11, fontWeight: 600, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4
        }}>
          Conteúdo
        </label>
        <textarea
          value={section.content}
          onChange={e => updateCustomSection(id, { content: e.target.value })}
          placeholder="Descreve os conteúdos desta secção..."
          rows={5}
          style={{
            ...inputStyle,
            resize: 'vertical',
            lineHeight: 1.6,
            fontFamily: 'inherit',
          }}
          onFocus={e => (e.target.style.borderColor = '#f59e0b')}
          onBlur={e => (e.target.style.borderColor = '#334155')}
        />
      </div>
    </div>
  )
}
