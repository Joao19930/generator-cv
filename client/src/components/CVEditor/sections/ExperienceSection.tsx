import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
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
import AIButton from '../AIButton'

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

function ExperienceItem({ item, dragListeners }: { item: Experience; dragListeners?: React.HTMLAttributes<HTMLElement> }) {
  const { updateExperience, removeExperience } = useCVStore()
  const [open, setOpen] = useState(true)

  const aiPrompt = `Escreve uma descrição profissional para experiência de trabalho num CV (máx 4 bullets com •).
Cargo: ${item.role || 'não especificado'}
Empresa: ${item.company || 'não especificada'}
Responsabilidades actuais: ${item.description || 'nenhuma'}
Escreve apenas os bullets, sem título.`

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
                placeholder="Eng. de Software"
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
                placeholder="Lisboa, Portugal"
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={labelStyle}>Data início</label>
              <input type="month" style={inputStyle} value={item.startDate} onChange={e => updateExperience(item.id, { startDate: e.target.value })}
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={labelStyle}>Data fim</label>
              <input type="month" style={{ ...inputStyle, opacity: item.current ? 0.4 : 1 }} value={item.endDate}
                disabled={item.current} onChange={e => updateExperience(item.id, { endDate: e.target.value })}
                onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }} />
            </div>
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
              <AIButton prompt={aiPrompt} onResult={text => updateExperience(item.id, { description: text })}>
                Melhorar
              </AIButton>
            </div>

            {item.role && (!item.description || item.description.length < 20) && (
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
                <AIButton
                  prompt={aiPrompt}
                  onResult={text => updateExperience(item.id, { description: text })}
                >
                  Gerar →
                </AIButton>
              </div>
            )}

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
              onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
            />
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
      {experience.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>
          Ainda não tens experiências — adiciona a primeira!
        </div>
      )}

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
