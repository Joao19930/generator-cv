import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import {
  User, FileText, Briefcase, GraduationCap, Zap,
  Globe, Award, Plus, ChevronDown, ChevronUp, GripVertical, Sparkles
} from 'lucide-react'
import { useCVStore } from '../../store/cvStore'
import PersonalSection from './sections/PersonalSection'
import SummarySection from './sections/SummarySection'
import ExperienceSection from './sections/ExperienceSection'
import EducationSection from './sections/EducationSection'
import SkillsSection from './sections/SkillsSection'
import LanguagesSection from './sections/LanguagesSection'
import CertificationsSection from './sections/CertificationsSection'
import CustomSectionEditor from './sections/CustomSection'

const SECTION_META: Record<string, { label: string; icon: React.ReactNode; hasAI?: boolean }> = {
  personal: { label: 'Informação Pessoal', icon: <User size={14} /> },
  summary: { label: 'Resumo Profissional', icon: <FileText size={14} />, hasAI: true },
  experience: { label: 'Experiência', icon: <Briefcase size={14} />, hasAI: true },
  education: { label: 'Formação', icon: <GraduationCap size={14} /> },
  skills: { label: 'Competências', icon: <Zap size={14} /> },
  languages: { label: 'Idiomas', icon: <Globe size={14} /> },
  certifications: { label: 'Certificações', icon: <Award size={14} /> },
}

function calculateCompletion(store: ReturnType<typeof useCVStore.getState>): number {
  let score = 0
  const max = 10

  if (store.personal.fullName) score += 1
  if (store.personal.email) score += 1
  if (store.personal.phone) score += 0.5
  if (store.personal.jobTitle) score += 1
  if (store.personal.address) score += 0.5
  if (store.summary && store.summary.length > 50) score += 1.5
  if (store.experience.length > 0) score += 1.5
  if (store.education.length > 0) score += 1
  if (store.skills.length >= 3) score += 1
  if (store.languages.length > 0) score += 0.5

  return Math.min(100, Math.round((score / max) * 100))
}

interface SortableItemProps {
  id: string
  children: React.ReactNode
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
    >
      {React.cloneElement(children as React.ReactElement, { dragListeners: listeners })}
    </div>
  )
}

interface SectionHeaderProps {
  sectionKey: string
  dragListeners?: React.HTMLAttributes<HTMLElement>
}

function SectionHeader({ sectionKey, dragListeners }: SectionHeaderProps) {
  const [open, setOpen] = useState(sectionKey === 'personal')
  const store = useCVStore()

  const isCustom = sectionKey.startsWith('custom_')
  const customId = isCustom ? sectionKey.replace('custom_', '') : null
  const customSection = customId ? store.customSections.find(s => s.id === customId) : null

  const meta = isCustom
    ? { label: customSection?.title || 'Secção Personalizada', icon: <Plus size={14} /> }
    : SECTION_META[sectionKey]

  if (!meta) return null

  return (
    <div
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Drag handle */}
        <span
          {...dragListeners}
          style={{ color: '#475569', cursor: 'grab', display: 'flex', padding: 2 }}
          onClick={e => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </span>

        {/* Icon + Label */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}
          onClick={() => setOpen(o => !o)}
        >
          <span style={{ color: '#64748b' }}>{meta.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{meta.label}</span>
          {(meta as any).hasAI && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#a78bfa',
              background: '#1e1b4b',
              border: '1px solid #4c1d95',
              borderRadius: 4,
              padding: '1px 5px',
              letterSpacing: '0.04em',
            }}>
              IA
            </span>
          )}
        </div>

        <div onClick={() => setOpen(o => !o)} style={{ color: '#475569' }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid #1e293b' }}>
          <div style={{ paddingTop: 10 }}>
            {sectionKey === 'personal' && <PersonalSection />}
            {sectionKey === 'summary' && <SummarySection />}
            {sectionKey === 'experience' && <ExperienceSection />}
            {sectionKey === 'education' && <EducationSection />}
            {sectionKey === 'skills' && <SkillsSection />}
            {sectionKey === 'languages' && <LanguagesSection />}
            {sectionKey === 'certifications' && <CertificationsSection />}
            {isCustom && customId && <CustomSectionEditor id={customId} />}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LeftPanel() {
  const store = useCVStore()
  const pct = calculateCompletion(store)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = store.sectionOrder.indexOf(active.id as string)
      const newIndex = store.sectionOrder.indexOf(over.id as string)
      store.setSectionOrder(arrayMove(store.sectionOrder, oldIndex, newIndex))
    }
  }

  const progressColor = pct < 40 ? '#ef4444' : pct < 70 ? '#f59e0b' : '#10b981'
  const progressMsg = pct < 40 ? 'Começa a preencher o teu CV' : pct < 70 ? 'Bom progresso! Continua...' : pct < 90 ? 'Quase perfeito!' : 'CV completo!'

  return (
    <div
      style={{
        width: 420,
        flexShrink: 0,
        background: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Progress bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{progressMsg}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: progressColor }}>{pct}%</span>
        </div>
        <div style={{ height: 5, background: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: progressColor,
            borderRadius: 3,
            transition: 'width 0.5s ease, background 0.3s ease',
          }} />
        </div>
      </div>

      {/* Sections list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={store.sectionOrder} strategy={verticalListSortingStrategy}>
            {store.sectionOrder.map(key => (
              <SortableItem key={key} id={key}>
                <SectionHeader sectionKey={key} />
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>

        {/* Add custom section */}
        <button
          type="button"
          onClick={() => store.addCustomSection()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            border: '1px dashed #334155',
            borderRadius: 10,
            color: '#64748b',
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 4,
            marginBottom: 16,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b' }}
        >
          <Plus size={14} />
          Adicionar Secção
        </button>
      </div>
    </div>
  )
}
