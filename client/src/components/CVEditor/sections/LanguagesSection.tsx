import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCVStore, Language } from '../../../store/cvStore'

const LEVELS = ['Nativo', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']

const inputStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#f8fafc',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s',
  width: '100%',
}

function LanguageRow({ item }: { item: Language }) {
  const { updateLanguage, removeLanguage } = useCVStore()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        style={{ ...inputStyle, flex: 1 }}
        value={item.name}
        onChange={e => updateLanguage(item.id, { name: e.target.value })}
        placeholder="Idioma (ex: Inglês)"
        onFocus={e => (e.target.style.borderColor = '#f59e0b')}
        onBlur={e => (e.target.style.borderColor = '#334155')}
      />
      <select
        value={item.level}
        onChange={e => updateLanguage(item.id, { level: e.target.value })}
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '8px 10px',
          color: '#94a3b8',
          fontSize: 12,
          outline: 'none',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button
        type="button"
        onClick={() => removeLanguage(item.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, flexShrink: 0 }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function LanguagesSection() {
  const { languages, addLanguage } = useCVStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {languages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#475569', fontSize: 13 }}>
          Adiciona os idiomas que dominas
        </div>
      )}
      {languages.map(item => (
        <LanguageRow key={item.id} item={item} />
      ))}
      <button
        type="button"
        onClick={addLanguage}
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
        Adicionar Idioma
      </button>
    </div>
  )
}
