import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useCVStore, Certification } from '../../../store/cvStore'

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

function CertificationItem({ item }: { item: Certification }) {
  const { updateCertification, removeCertification } = useCVStore()
  const [open, setOpen] = useState(true)

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name || 'Nova certificação'}
          </p>
          <p style={{ fontSize: 11, color: '#64748b' }}>{item.issuer || 'Entidade emissora'}</p>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); removeCertification(item.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
        >
          <Trash2 size={14} />
        </button>
        {open ? <ChevronUp size={14} style={{ color: '#475569' }} /> : <ChevronDown size={14} style={{ color: '#475569' }} />}
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>Nome da Certificação</label>
            <input style={inputStyle} value={item.name} onChange={e => updateCertification(item.id, { name: e.target.value })}
              placeholder="AWS Solutions Architect" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Entidade</label>
              <input style={inputStyle} value={item.issuer} onChange={e => updateCertification(item.id, { issuer: e.target.value })}
                placeholder="Amazon Web Services" onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
            <div>
              <label style={labelStyle}>Data</label>
              <input type="month" style={inputStyle} value={item.date} onChange={e => updateCertification(item.id, { date: e.target.value })}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>URL / Link</label>
            <input style={inputStyle} type="url" value={item.url} onChange={e => updateCertification(item.id, { url: e.target.value })}
              placeholder="https://..." onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = '#334155')} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function CertificationsSection() {
  const { certifications, addCertification } = useCVStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {certifications.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#475569', fontSize: 13 }}>
          Adiciona as tuas certificações e cursos
        </div>
      )}
      {certifications.map(item => (
        <CertificationItem key={item.id} item={item} />
      ))}
      <button
        type="button"
        onClick={addCertification}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', padding: '9px 16px',
          background: '#1e293b', border: '1px dashed #334155', borderRadius: 8,
          color: '#94a3b8', fontSize: 13, cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8' }}
      >
        <Plus size={15} />
        Adicionar Certificação
      </button>
    </div>
  )
}
