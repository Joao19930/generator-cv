import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useCVStore, Skill, SkillLevel } from '../../../store/cvStore'
import SuggestionsPanel from '../forms/SuggestionsPanel'

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
        background: '#EFF6FF',
        border: `1px solid ${LEVEL_COLORS[skill.level]}30`,
        borderRadius: 20,
        fontSize: 12,
        position: 'relative',
      }}
    >
      <span style={{ color: '#1E293B' }}>{skill.name}</span>
      <button
        type="button"
        onClick={() => setShowLevel(s => !s)}
        style={{
          padding: '1px 6px',
          background: `${LEVEL_COLORS[skill.level]}15`,
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
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 0, display: 'flex', alignItems: 'center' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
      >
        <X size={11} />
      </button>

      {showLevel && (
        <div
          style={{
            position: 'absolute' as const,
            zIndex: 50,
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
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
                whiteSpace: 'nowrap',
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
      <SuggestionsPanel />

      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nome da competência..."
          style={{
            flex: 1,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '10px 12px',
            color: '#1E293B',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
        />
        <select
          value={level}
          onChange={e => setLevel(e.target.value as SkillLevel)}
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            padding: '10px 10px',
            color: '#64748B',
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
            width: 42,
            height: 42,
            background: '#1E40AF',
            border: 'none',
            borderRadius: 10,
            color: '#FFFFFF',
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
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#94A3B8', fontSize: 13 }}>
          Escreve uma competência e prime Enter para adicionar
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {skills.map(skill => (
          <SkillTag key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  )
}
