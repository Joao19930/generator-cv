import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useCVStore, SkillLevel } from '../../../store/cvStore'

const LEVELS: SkillLevel[] = ['Básico', 'Intermédio', 'Avançado', 'Expert']

const LEVEL_COLORS: Record<SkillLevel, string> = {
  'Básico': '#64748b',
  'Intermédio': '#3b82f6',
  'Avançado': '#10b981',
  'Expert': '#f59e0b',
}

export default function HabilidadesSection() {
  const { habilidades, addHabilidade, removeHabilidade, updateHabilidade } = useCVStore()
  const [input, setInput] = useState('')
  const [level, setLevel] = useState<SkillLevel>('Intermédio')

  function handleAdd() {
    const name = input.trim()
    if (!name) return
    addHabilidade(name, level)
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="ex: Excel Avançado, Power BI..."
          style={{
            flex: 1, background: '#0f172a', border: '1px solid #334155',
            borderRadius: 8, padding: '8px 12px', color: '#f8fafc', fontSize: 13,
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#f59e0b')}
          onBlur={e => (e.target.style.borderColor = '#334155')}
        />
        <select
          value={level}
          onChange={e => setLevel(e.target.value as SkillLevel)}
          style={{
            background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
            padding: '8px 10px', color: '#94a3b8', fontSize: 12, outline: 'none', cursor: 'pointer',
          }}
        >
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
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

      {habilidades.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: '#475569', fontSize: 13 }}>
          Adiciona ferramentas e tecnologias que dominas
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {habilidades.map(h => (
          <div key={h.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{h.name}</span>
                <select
                  value={h.level}
                  onChange={e => updateHabilidade(h.id, { level: e.target.value as SkillLevel })}
                  style={{
                    background: 'transparent', border: 'none', color: LEVEL_COLORS[h.level],
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ height: 3, background: '#1e293b', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: LEVEL_COLORS[h.level],
                  width: h.level === 'Expert' ? '95%' : h.level === 'Avançado' ? '80%' : h.level === 'Intermédio' ? '60%' : '40%',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
            <button
              type="button" onClick={() => removeHabilidade(h.id)}
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
