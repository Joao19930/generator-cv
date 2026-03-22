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

const MONTHS = [
  { v: '01', l: 'Jan' }, { v: '02', l: 'Fev' }, { v: '03', l: 'Mar' },
  { v: '04', l: 'Abr' }, { v: '05', l: 'Mai' }, { v: '06', l: 'Jun' },
  { v: '07', l: 'Jul' }, { v: '08', l: 'Ago' }, { v: '09', l: 'Set' },
  { v: '10', l: 'Out' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dez' },
]

function MonthYearInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split('-') : ['', '']
  const yr = parts[0] || ''
  const mo = parts[1] || ''

  function update(newYr: string, newMo: string) {
    if (newYr && newMo) onChange(`${newYr}-${newMo}`)
    else if (newYr) onChange(newYr)
    else onChange('')
  }

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={mo}
          onChange={e => update(yr, e.target.value)}
          style={{ ...inputStyle, flex: 1, padding: '10px 8px' }}
          onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
        >
          <option value="">Mês</option>
          {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <input
          type="text"
          value={yr}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); update(v, mo) }}
          placeholder="Ano"
          style={{ ...inputStyle, width: 72, padding: '10px 8px' }}
          onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
        />
      </div>
    </div>
  )
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
                placeholder="Universidade Agostinho Neto"
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
                placeholder="Gestão de Empresas"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <MonthYearInput label="Data início" value={item.startDate} onChange={v => updateEducation(item.id, { startDate: v })} />
            <MonthYearInput label="Data fim" value={item.endDate} onChange={v => updateEducation(item.id, { endDate: v })} />
          </div>
          <div>
            <label style={labelStyle}>Notas / Descrição</label>
            <textarea
              value={item.description}
              onChange={e => updateEducation(item.id, { description: e.target.value })}
              placeholder="Média: 15/20, tese sobre gestão de recursos..."
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
