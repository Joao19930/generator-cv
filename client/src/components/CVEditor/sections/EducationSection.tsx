import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useCVStore, Education } from '../../../store/cvStore'

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

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 4,
}

function EducationItem({ item }: { item: Education }) {
  const { updateEducation, removeEducation } = useCVStore()
  const [open, setOpen] = useState(true)

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.degree || 'Nova formação'}
          </p>
          <p style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.institution || 'Instituição'}
          </p>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); removeEducation(item.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
        >
          <Trash2 size={14} />
        </button>
        {open ? <ChevronUp size={14} style={{ color: '#475569' }} /> : <ChevronDown size={14} style={{ color: '#475569' }} />}
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instituição</label>
              <input style={inputStyle} value={item.institution} onChange={e => updateEducation(item.id, { institution: e.target.value })}
                placeholder="Universidade de Lisboa" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Grau / Título</label>
              <input style={inputStyle} value={item.degree} onChange={e => updateEducation(item.id, { degree: e.target.value })}
                placeholder="Licenciatura" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Área</label>
              <input style={inputStyle} value={item.field} onChange={e => updateEducation(item.id, { field: e.target.value })}
                placeholder="Engenharia Informática" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Data início</label>
              <input type="month" style={inputStyle} value={item.startDate} onChange={e => updateEducation(item.id, { startDate: e.target.value })}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Data fim</label>
              <input type="month" style={inputStyle} value={item.endDate} onChange={e => updateEducation(item.id, { endDate: e.target.value })}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notas / Descrição</label>
            <textarea
              value={item.description}
              onChange={e => updateEducation(item.id, { description: e.target.value })}
              placeholder="Média: 17/20, tese sobre..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
              onFocus={e => (e.target.style.borderColor = '#f59e0b')}
              onBlur={e => (e.target.style.borderColor = '#334155')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function EducationSection() {
  const { education, addEducation } = useCVStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {education.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#475569', fontSize: 13 }}>
          Ainda não tens formações — adiciona a primeira!
        </div>
      )}
      {education.map(item => (
        <EducationItem key={item.id} item={item} />
      ))}
      <button
        type="button"
        onClick={addEducation}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          padding: '9px 16px',
          background: '#1e293b',
          border: '1px dashed #334155',
          borderRadius: 8,
          color: '#94a3b8',
          fontSize: 13,
          cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
      >
        <Plus size={15} />
        Adicionar Formação
      </button>
    </div>
  )
}
