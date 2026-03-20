import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import { useCVStore, Experience } from '../../../store/cvStore'
import AIButton from '../AIButton'

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

function ExperienceItem({ item }: { item: Experience }) {
  const { updateExperience, removeExperience } = useCVStore()
  const [open, setOpen] = useState(true)

  const aiPrompt = `Escreve uma descrição profissional para experiência de trabalho num CV (máx 4 bullets com •).
Cargo: ${item.role || 'não especificado'}
Empresa: ${item.company || 'não especificada'}
Responsabilidades actuais: ${item.description || 'nenhuma'}
Escreve apenas os bullets, sem título.`

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          cursor: 'pointer',
          background: '#0f172a',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.role || 'Novo cargo'}
          </p>
          <p style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.company || 'Empresa'}
          </p>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); removeExperience(item.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
        >
          <Trash2 size={14} />
        </button>
        {open ? <ChevronUp size={14} style={{ color: '#475569' }} /> : <ChevronDown size={14} style={{ color: '#475569' }} />}
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Cargo</label>
              <input style={inputStyle} value={item.role} onChange={e => updateExperience(item.id, { role: e.target.value })}
                placeholder="Eng. de Software" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Empresa</label>
              <input style={inputStyle} value={item.company} onChange={e => updateExperience(item.id, { company: e.target.value })}
                placeholder="Empresa Lda" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Localização</label>
              <input style={inputStyle} value={item.location} onChange={e => updateExperience(item.id, { location: e.target.value })}
                placeholder="Lisboa, Portugal" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Data início</label>
              <input type="month" style={inputStyle} value={item.startDate} onChange={e => updateExperience(item.id, { startDate: e.target.value })}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Data fim</label>
              <input type="month" style={{ ...inputStyle, opacity: item.current ? 0.4 : 1 }} value={item.endDate}
                disabled={item.current} onChange={e => updateExperience(item.id, { endDate: e.target.value })}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => updateExperience(item.id, { current: !item.current })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.current ? '#f59e0b' : '#475569' }}
            >
              {item.current ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Emprego actual</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={labelStyle}>Descrição</label>
              <AIButton prompt={aiPrompt} onResult={text => updateExperience(item.id, { description: text })}>
                Melhorar
              </AIButton>
            </div>
            <textarea
              value={item.description}
              onChange={e => updateExperience(item.id, { description: e.target.value })}
              placeholder="• Desenvolveu funcionalidades para a plataforma&#10;• Liderou equipa de 3 engenheiros&#10;• Reduziu tempo de resposta em 40%"
              rows={4}
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
      )}
    </div>
  )
}

export default function ExperienceSection() {
  const { experience, addExperience } = useCVStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {experience.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#475569', fontSize: 13 }}>
          Ainda não tens experiências — adiciona a primeira!
        </div>
      )}
      {experience.map(item => (
        <ExperienceItem key={item.id} item={item} />
      ))}
      <button
        type="button"
        onClick={addExperience}
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
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
      >
        <Plus size={15} />
        Adicionar Experiência
      </button>
    </div>
  )
}
