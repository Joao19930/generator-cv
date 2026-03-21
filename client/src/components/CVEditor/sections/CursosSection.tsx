import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useCVStore } from '../../../store/cvStore'

export default function CursosSection() {
  const { cursos, setCursos } = useCVStore()
  const [input, setInput] = useState('')

  function handleAdd() {
    const val = input.trim()
    if (!val || cursos.includes(val)) return
    setCursos([...cursos, val])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="ex: Excel Avançado para RH..."
          style={{
            flex: 1, background: '#0f172a', border: '1px solid #334155',
            borderRadius: 8, padding: '8px 12px', color: '#f8fafc', fontSize: 13,
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#f59e0b')}
          onBlur={e => (e.target.style.borderColor = '#334155')}
        />
        <button
          type="button" onClick={handleAdd}
          style={{
            width: 36, height: 36, background: '#f59e0b', border: 'none', borderRadius: 8,
            color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {cursos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: '#475569', fontSize: 13 }}>
          Adiciona cursos, formações e certificados
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {cursos.map((c, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '9px 12px',
          }}>
            <span style={{ fontSize: 12, color: '#e2e8f0' }}>{c}</span>
            <button
              type="button"
              onClick={() => setCursos(cursos.filter((_, idx) => idx !== i))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2, display: 'flex' }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
