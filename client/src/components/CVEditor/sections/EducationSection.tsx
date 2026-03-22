import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useCVStore, Education } from '../../../store/cvStore'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#1E293B',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 4,
}

function EducationItem({ item }: { item: Education }) {
  const { updateEducation, removeEducation } = useCVStore()
  const [open, setOpen] = useState(true)

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: '#F8FAFC' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {item.degree || 'Nova formação'}
          </p>
          <p style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {item.institution || 'Instituição'}
          </p>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); removeEducation(item.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
        >
          <Trash2 size={14} />
        </button>
        {open ? <ChevronUp size={14} style={{ color: '#CBD5E1' }} /> : <ChevronDown size={14} style={{ color: '#CBD5E1' }} />}
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instituição</label>
              <input style={inputStyle} value={item.institution} onChange={e => updateEducation(item.id, { institution: e.target.value })}
                placeholder="Universidade de Lisboa"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={labelStyle}>Grau / Título</label>
              <input style={inputStyle} value={item.degree} onChange={e => updateEducation(item.id, { degree: e.target.value })}
                placeholder="Licenciatura"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={labelStyle}>Área</label>
              <input style={inputStyle} value={item.field} onChange={e => updateEducation(item.id, { field: e.target.value })}
                placeholder="Engenharia Informática"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={labelStyle}>Data início</label>
              <input type="month" style={inputStyle} value={item.startDate} onChange={e => updateEducation(item.id, { startDate: e.target.value })}
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={labelStyle}>Data fim</label>
              <input type="month" style={inputStyle} value={item.endDate} onChange={e => updateEducation(item.id, { endDate: e.target.value })}
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
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
              onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
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
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>
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
          background: '#F8FAFC',
          border: '1px dashed #CBD5E1',
          borderRadius: 8,
          color: '#94A3B8',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1E40AF'; (e.currentTarget as HTMLButtonElement).style.color = '#1E40AF' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8' }}
      >
        <Plus size={15} />
        Adicionar Formação
      </button>
    </div>
  )
}
