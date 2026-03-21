import { useState } from 'react'
import toast from 'react-hot-toast'
import { useCVStore } from '../../../store/cvStore'
import { SUGGESTIONS, FUNCAO_OPTIONS, type TabKey, type SuggestionItem } from '../../../data/suggestions'

const TAB_LABELS: Record<TabKey, string> = {
  comp: 'Competências',
  tec: 'Técnicas',
  cursos: 'Cursos',
  inter: 'Interesses',
}

const TAB_ICONS: Record<TabKey, string> = {
  comp: '🧠',
  tec: '⚙️',
  cursos: '📚',
  inter: '⭐',
}

export default function SuggestionsPanel() {
  const store = useCVStore()
  const {
    funcaoArea, setFuncaoArea,
    skills, addSkill, removeSkill,
    habilidades, addHabilidade, removeHabilidade,
    cursos, setCursos,
    interesses, setInteresses,
  } = store

  const [activeTab, setActiveTab] = useState<TabKey>('comp')
  const [customInput, setCustomInput] = useState('')

  // ── Helpers ──────────────────────────────────────────────

  const suggestions: (SuggestionItem | string)[] =
    funcaoArea && SUGGESTIONS[funcaoArea]
      ? (SUGGESTIONS[funcaoArea][activeTab] as (SuggestionItem | string)[]) || []
      : []

  function isSelected(item: SuggestionItem | string): boolean {
    const text = typeof item === 'string' ? item : item.text
    if (activeTab === 'comp') return skills.some(s => s.name === text)
    if (activeTab === 'tec') return habilidades.some(h => h.name === text)
    if (activeTab === 'cursos') return cursos.includes(text)
    return interesses.includes(text)
  }

  function toggle(item: SuggestionItem | string) {
    const text = typeof item === 'string' ? item : item.text
    const nivel = typeof item === 'object' ? item.nivel : undefined

    if (activeTab === 'comp') {
      const existing = skills.find(s => s.name === text)
      if (existing) removeSkill(existing.id)
      else addSkill(text, nivel || 'Intermédio')
    } else if (activeTab === 'tec') {
      const existing = habilidades.find(h => h.name === text)
      if (existing) removeHabilidade(existing.id)
      else addHabilidade(text, nivel || 'Intermédio')
    } else if (activeTab === 'cursos') {
      if (cursos.includes(text)) setCursos(cursos.filter(c => c !== text))
      else setCursos([...cursos, text])
    } else {
      if (interesses.includes(text)) setInteresses(interesses.filter(i => i !== text))
      else setInteresses([...interesses, text])
    }
  }

  function handleRemoveSelected(text: string) {
    if (activeTab === 'comp') {
      const s = skills.find(sk => sk.name === text)
      if (s) removeSkill(s.id)
    } else if (activeTab === 'tec') {
      const h = habilidades.find(hb => hb.name === text)
      if (h) removeHabilidade(h.id)
    } else if (activeTab === 'cursos') {
      setCursos(cursos.filter(c => c !== text))
    } else {
      setInteresses(interesses.filter(i => i !== text))
    }
  }

  function selectedItems(): string[] {
    if (activeTab === 'comp') return skills.map(s => s.name)
    if (activeTab === 'tec') return habilidades.map(h => h.name)
    if (activeTab === 'cursos') return cursos
    return interesses
  }

  function handleAutoIA() {
    const notSelected = suggestions.filter(s => !isSelected(s)).slice(0, 5)
    notSelected.forEach(item => toggle(item))
    toast.success(`Top ${notSelected.length} ${TAB_LABELS[activeTab].toLowerCase()} adicionadas!`)
  }

  function handleAddCustom() {
    const val = customInput.trim()
    if (!val) return
    if (activeTab === 'comp') addSkill(val, 'Intermédio')
    else if (activeTab === 'tec') addHabilidade(val, 'Intermédio')
    else if (activeTab === 'cursos') setCursos([...cursos, val])
    else setInteresses([...interesses, val])
    setCustomInput('')
  }

  const sel = selectedItems()

  // ── Render ────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Function selector */}
      <select
        value={funcaoArea}
        onChange={e => setFuncaoArea(e.target.value)}
        style={{
          width: '100%',
          background: '#0f172a',
          border: '1px solid #374151',
          borderRadius: 7,
          padding: '7px 10px',
          color: funcaoArea ? '#d1d5db' : '#6b7280',
          fontSize: 12,
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="">— Seleccionar área profissional —</option>
        {FUNCAO_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* 4 Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1e293b', paddingBottom: 8 }}>
        {(['comp', 'tec', 'cursos', 'inter'] as TabKey[]).map(tab => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                border: active ? 'none' : '1px solid #374151',
                background: active ? '#b5a48a' : 'transparent',
                color: active ? '#1a1a1a' : '#6b7280',
                transition: 'all .15s',
              }}
            >
              {TAB_LABELS[tab]}
            </button>
          )
        })}
      </div>

      {/* Selected items card */}
      {sel.length > 0 && (
        <div style={{
          background: '#0f172a',
          border: '1px solid #374151',
          borderRadius: 8,
          padding: 8,
        }}>
          <span style={{ fontSize: 8, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {TAB_LABELS[activeTab]} seleccionadas ({sel.length})
          </span>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {sel.map(text => (
              <div key={text} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9.5, color: '#d1d5db' }}>{text}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSelected(text)}
                  style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions list — always vertical */}
      {funcaoArea ? (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280, overflowY: 'auto' }}>
          {(suggestions as (SuggestionItem | string)[]).map((item, idx) => {
            const text = typeof item === 'string' ? item : item.text
            const sub = typeof item === 'object' ? item.sub : undefined
            const nivel = typeof item === 'object' ? item.nivel : undefined
            const selected = isSelected(item)

            return (
              <div
                key={idx}
                onClick={() => toggle(item)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: selected ? '#1a2535' : '#111827',
                  border: `1px solid ${selected ? '#b5a48a' : '#374151'}`,
                  borderRadius: 7,
                  padding: '7px 10px',
                  marginBottom: 5,
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                }}
                onMouseEnter={e => {
                  if (!selected) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#b5a48a'
                    ;(e.currentTarget as HTMLDivElement).style.background = '#1a2535'
                  }
                }}
                onMouseLeave={e => {
                  if (!selected) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#374151'
                    ;(e.currentTarget as HTMLDivElement).style.background = '#111827'
                  }
                }}
              >
                {/* Left side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{TAB_ICONS[activeTab]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: selected ? 500 : 400,
                      color: selected ? '#f9fafb' : '#d1d5db',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {text}
                    </div>
                    {sub && (
                      <div style={{ fontSize: 8, color: '#6b7280', marginTop: 1 }}>{sub}</div>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  {nivel && (
                    <span style={{ fontSize: 8, color: '#b5a48a', fontWeight: 500 }}>{nivel}</span>
                  )}
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: selected ? '#b5a48a' : 'transparent',
                    border: selected ? 'none' : '1px solid #374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    color: '#fff',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {selected ? '✓' : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#475569', fontSize: 12 }}>
          Selecciona uma área profissional para ver sugestões
        </div>
      )}

      {/* Auto IA + custom input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleAutoIA}
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '5px 10px',
            fontSize: 9,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          ✦ Auto IA
        </button>
        <input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
          placeholder={`ex: ${activeTab === 'comp' ? 'Gestão de Conflitos' : activeTab === 'tec' ? 'Power Automate' : activeTab === 'cursos' ? 'Curso de Liderança' : 'Viagens e Culturas'}`}
          style={{
            flex: 1,
            background: '#0f172a',
            border: '1px solid #374151',
            borderRadius: 7,
            padding: '6px 9px',
            color: '#d1d5db',
            fontSize: 11,
            outline: 'none',
            transition: 'border-color .15s',
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = '#b5a48a' }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = '#374151' }}
        />
        <button
          type="button"
          onClick={handleAddCustom}
          style={{
            background: '#374151',
            color: '#f9fafb',
            border: 'none',
            borderRadius: 7,
            padding: '6px 10px',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          +
        </button>
      </div>

    </div>
  )
}
