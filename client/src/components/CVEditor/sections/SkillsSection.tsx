import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useCVStore, Skill, SkillLevel } from '../../../store/cvStore'

const LEVELS: SkillLevel[] = ['Básico', 'Intermédio', 'Avançado', 'Expert']

const LEVEL_COLORS: Record<SkillLevel, string> = {
  'Básico': '#64748b',
  'Intermédio': '#3b82f6',
  'Avançado': '#10b981',
  'Expert': '#f59e0b',
}

function SkillTag({ skill }: { skill: Skill }) {
  const { removeSkill, updateSkill } = useCVStore()
  const [showLevel, setShowLevel] = useState(false)

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: '#1e293b',
        border: `1px solid ${LEVEL_COLORS[skill.level]}40`,
        borderRadius: 20,
        fontSize: 12,
      }}
    >
      <span style={{ color: '#e2e8f0' }}>{skill.name}</span>
      <button
        type="button"
        onClick={() => setShowLevel(s => !s)}
        style={{
          padding: '1px 6px',
          background: `${LEVEL_COLORS[skill.level]}20`,
          border: 'none',
          borderRadius: 10,
          color: LEVEL_COLORS[skill.level],
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {skill.level}
      </button>
      <button
        type="button"
        onClick={() => removeSkill(skill.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0, display: 'flex', alignItems: 'center' }}
      >
        <X size={11} />
      </button>

      {showLevel && (
        <div
          style={{
            position: 'absolute' as const,
            zIndex: 50,
            marginTop: 4,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {LEVELS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => { updateSkill(skill.id, { level: l }); setShowLevel(false) }}
              style={{
                padding: '4px 10px',
                background: skill.level === l ? `${LEVEL_COLORS[l]}20` : 'transparent',
                border: 'none',
                borderRadius: 6,
                color: LEVEL_COLORS[l],
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: skill.level === l ? 700 : 400,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SkillsSection() {
  const { skills, addSkill } = useCVStore()
  const [input, setInput] = useState('')
  const [level, setLevel] = useState<SkillLevel>('Intermédio')

  function handleAdd() {
    const name = input.trim()
    if (!name) return
    addSkill(name, level)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nome da competência..."
          style={{
            flex: 1,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: 13,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#f59e0b')}
          onBlur={e => (e.target.style.borderColor = '#334155')}
        />
        <select
          value={level}
          onChange={e => setLevel(e.target.value as SkillLevel)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 10px',
            color: '#94a3b8',
            fontSize: 12,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          style={{
            width: 36,
            height: 36,
            background: '#f59e0b',
            border: 'none',
            borderRadius: 8,
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {skills.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#475569', fontSize: 13 }}>
          Escreve uma competência e prime Enter para adicionar
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, position: 'relative' }}>
        {skills.map(skill => (
          <SkillTag key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  )
}
