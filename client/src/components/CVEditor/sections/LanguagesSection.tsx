import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCVStore, Language } from '../../../store/cvStore'

const LEVELS = ['Nativo', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']

const inputStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#1E293B',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  width: '100%',
}

function LanguageRow({ item }: { item: Language }) {
  const { updateLanguage, removeLanguage } = useCVStore()

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#FFFFFF', border: '1px solid #E2E8F0',
      borderRadius: 10, padding: '8px 10px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <input
        style={{ ...inputStyle, flex: 1, border: 'none', padding: '4px 6px', boxShadow: 'none' }}
        value={item.name}
        onChange={e => updateLanguage(item.id, { name: e.target.value })}
        placeholder="Ex: Inglês"
        onFocus={e => (e.target.style.outline = 'none')}
        onBlur={e => (e.target.style.outline = 'none')}
      />
      <select
        value={item.level}
        onChange={e => updateLanguage(item.id, { level: e.target.value })}
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '6px 10px',
          color: '#475569',
          fontSize: 12,
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onFocus={e => { e.target.style.borderColor = '#1E40AF' }}
        onBlur={e => { e.target.style.borderColor = '#E2E8F0' }}
      >
        {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <button
        type="button"
        onClick={() => removeLanguage(item.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
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
      {languages.map(item => (
        <LanguageRow key={item.id} item={item} />
      ))}
      {languages.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#94A3B8', fontSize: 13 }}>
          Adiciona os idiomas que dominas
        </div>
      )}
      <button
        type="button"
        onClick={addLanguage}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', padding: '9px 16px',
          background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8,
          color: '#94A3B8', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1E40AF'; (e.currentTarget as HTMLButtonElement).style.color = '#1E40AF' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8' }}
      >
        <Plus size={15} />
        Adicionar Idioma
      </button>
    </div>
  )
}
