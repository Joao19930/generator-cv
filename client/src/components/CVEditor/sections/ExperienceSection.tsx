import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, GripVertical, Wand2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCVStore, Experience } from '../../../store/cvStore'

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

function MonthYearInput({
  label, value, onChange, disabled,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const parts = value ? value.split('-') : ['', '']
  const yr = parts[0] || ''
  const externalMo = parts[1] || ''

  // Keep month in local state so selecting month before year doesn't lose it
  const [localMo, setLocalMo] = useState(externalMo)
  if (externalMo && externalMo !== localMo) setLocalMo(externalMo)

  function onMonthChange(newMo: string) {
    setLocalMo(newMo)
    if (yr && newMo) onChange(`${yr}-${newMo}`)
    else if (yr) onChange(yr)
  }

  function onYearChange(newYr: string) {
    const v = newYr.replace(/\D/g, '').slice(0, 4)
    if (v && localMo) onChange(`${v}-${localMo}`)
    else if (v) onChange(v)
    else onChange('')
  }

  const baseStyle: React.CSSProperties = {
    ...inputStyle,
    padding: '10px 8px',
    opacity: disabled ? 0.4 : 1,
  }

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={localMo}
          onChange={e => onMonthChange(e.target.value)}
          disabled={disabled}
          style={{ ...baseStyle, flex: 1 }}
          onFocus={e => { if (!disabled) { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' } }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
        >
          <option value="">Mês</option>
          {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <input
          type="text"
          value={yr}
          onChange={e => onYearChange(e.target.value)}
          placeholder="Ano"
          disabled={disabled}
          style={{ ...baseStyle, width: 72 }}
          onFocus={e => { if (!disabled) { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' } }}
          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
        />
      </div>
    </div>
  )
}

function ExperienceItem({ item, dragListeners }: { item: Experience; dragListeners?: React.HTMLAttributes<HTMLElement> }) {
  const { updateExperience, removeExperience } = useCVStore()
  const [open, setOpen] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [prevDesc, setPrevDesc] = useState<string>('')

  const aiPrompt = `Escreve uma descrição profissional para experiência de trabalho num CV (máx 4 bullets com •).
Cargo: ${item.role || 'não especificado'}
Empresa: ${item.company || 'não especificada'}
Responsabilidades actuais: ${item.description || 'nenhuma'}
Escreve apenas os bullets, sem título.`

  async function handleGenerate() {
    setPrevDesc(item.description)
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const data = await res.json()
      if (data.text) {
        setDraft(data.text)
        updateExperience(item.id, { description: data.text })
      }
    } catch {}
    setAiLoading(false)
  }

  function handleManter() {
    setDraft(null)
  }

  function handleDescartar() {
    updateExperience(item.id, { description: prevDesc })
    setDraft(null)
  }

  return (
    <div
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: '#F8FAFC',
        }}
      >
        {/* Drag handle */}
        <span
          {...dragListeners}
          style={{ color: '#CBD5E1', cursor: 'grab', display: 'flex', padding: 2, flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </span>

        {/* Title — click to expand */}
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
            {item.role || 'Novo cargo'}
          </p>
          <p style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
            {item.company || 'Empresa'}
          </p>
        </div>

        <button
          type="button"
          onClick={e => { e.stopPropagation(); removeExperience(item.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#CBD5E1')}
        >
          <Trash2 size={14} />
        </button>
        <div style={{ cursor: 'pointer', color: '#CBD5E1' }} onClick={() => setOpen(o => !o)}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Cargo</label>
              <input style={inputStyle} value={item.role} onChange={e => updateExperience(item.id, { role: e.target.value })}
                placeholder="Gestor Comercial"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={labelStyle}>Empresa</label>
              <input style={inputStyle} value={item.company} onChange={e => updateExperience(item.id, { company: e.target.value })}
                placeholder="Empresa Lda"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Localização</label>
              <input style={inputStyle} value={item.location} onChange={e => updateExperience(item.id, { location: e.target.value })}
                placeholder="Luanda, Angola"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <MonthYearInput label="Data início" value={item.startDate} onChange={v => updateExperience(item.id, { startDate: v })} />
            <MonthYearInput label="Data fim" value={item.endDate} onChange={v => updateExperience(item.id, { endDate: v })} disabled={item.current} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => updateExperience(item.id, { current: !item.current })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.current ? '#1E40AF' : '#CBD5E1' }}
            >
              {item.current ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Emprego actual</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={labelStyle}>Descrição</label>
              {!draft && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={aiLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px',
                    background: aiLoading ? '#E2E8F0' : 'linear-gradient(135deg,#22C55E,#16A34A)',
                    border: 'none', borderRadius: 6,
                    color: aiLoading ? '#94A3B8' : '#fff',
                    fontSize: 11, fontWeight: 700,
                    cursor: aiLoading ? 'wait' : 'pointer',
                  }}
                >
                  <Wand2 size={11} />
                  {aiLoading ? 'A gerar...' : 'Gerar com IA'}
                </button>
              )}
            </div>

            {item.role && !draft && (!item.description || item.description.length < 20) && (
              <div style={{
                padding: '10px 12px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 12, color: '#1E40AF', fontWeight: 500 }}>
                  💡 Gerar descrição para "<strong>{item.role}</strong>"
                </span>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={aiLoading}
                  style={{
                    padding: '4px 10px',
                    background: 'linear-gradient(135deg,#22C55E,#16A34A)',
                    border: 'none', borderRadius: 6,
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    cursor: aiLoading ? 'wait' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {aiLoading ? 'A gerar...' : 'Gerar →'}
                </button>
              </div>
            )}

            <textarea
              value={item.description}
              onChange={e => { updateExperience(item.id, { description: e.target.value }); if (draft !== null) setDraft(e.target.value) }}
              placeholder="• Geriu equipa comercial de 8 pessoas em Luanda&#10;• Aumentou volume de vendas em 35% em 2023&#10;• Negociou contratos com parceiros estratégicos"
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
            />

            {draft !== null && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleManter}
                  style={{
                    flex: 1, padding: '7px 0',
                    background: 'linear-gradient(135deg,#22C55E,#16A34A)',
                    border: 'none', borderRadius: 7,
                    color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ✓ Manter
                </button>
                <button
                  type="button"
                  onClick={handleDescartar}
                  style={{
                    flex: 1, padding: '7px 0',
                    background: '#F1F5F9',
                    border: '1px solid #E2E8F0', borderRadius: 7,
                    color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  ✕ Descartar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SortableExperienceItem({ item }: { item: Experience }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
    >
      <ExperienceItem item={item} dragListeners={listeners} />
    </div>
  )
}

export default function ExperienceSection() {
  const { experience, addExperience, reorderExperience } = useCVStore()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const ids = experience.map(e => e.id)
      const oldIndex = ids.indexOf(active.id as string)
      const newIndex = ids.indexOf(over.id as string)
      reorderExperience(arrayMove(ids, oldIndex, newIndex))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={experience.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {experience.map(item => (
            <SortableExperienceItem key={item.id} item={item} />
          ))}
        </SortableContext>
      </DndContext>

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
        Adicionar Experiência
      </button>
    </div>
  )
}
