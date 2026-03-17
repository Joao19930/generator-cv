import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Wand2, Plus, Trash2, Loader2 } from 'lucide-react'
import { useResumeStore } from '../hooks/useResumeStore'

const S = {
  panel: { width: 280, background: '#fff', borderRight: '0.5px solid rgba(0,0,0,0.08)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' },
  header: { padding: '16px 16px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', flexShrink: 0 },
  logo: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#1B3D6F' },
  logoGold: { color: '#C9A84C' },
  section: { borderBottom: '0.5px solid rgba(0,0,0,0.06)' },
  sectionHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', userSelect: 'none', fontSize: 13, fontWeight: 600, color: '#334155' },
  sectionBody: { padding: '4px 16px 14px' },
  label: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 10 },
  input: { width: '100%', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', background: '#fafafa', transition: 'border-color .15s' },
  textarea: { width: '100%', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '7px 10px', fontSize: 13, resize: 'vertical', minHeight: 72, outline: 'none', fontFamily: 'DM Sans, sans-serif', background: '#fafafa', lineHeight: 1.5 },
  aiBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', color: '#C9A84C', borderRadius: 4 },
  card: { background: '#f8fafc', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '12px', marginTop: 10 },
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#1B3D6F', background: 'none', border: '0.5px dashed #1B3D6F', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center', marginTop: 10 },
  trashBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#ef4444', borderRadius: 4, marginLeft: 'auto' },
  bulletRow: { display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 6 },
  titleBadge: { fontSize: 10, fontWeight: 700, color: '#fff', background: '#1B3D6F', borderRadius: 20, padding: '1px 8px', animation: 'pulse-dot 2s infinite', marginLeft: 6 },
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={S.section}>
      <div style={S.sectionHdr} onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {open && <div style={S.sectionBody}>{children}</div>}
    </div>
  )
}

function Field({ label, children, onAI }) {
  return (
    <div>
      <div style={S.label}>
        <span>{label}</span>
        {onAI && (
          <button style={S.aiBtn} onClick={onAI} title="Melhorar com IA">
            <Wand2 size={12} />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

export default function Editor({ onAIRequest }) {
  const { personalInfo, experience, education, skills,
    updatePersonalInfo, addExperience, updateExperience, removeExperience,
    updateBullet, addBullet, removeBullet,
    addEducation, updateEducation, removeEducation,
    addSkillCategory, updateSkillCategory, removeSkillCategory
  } = useResumeStore()

  const inp = (field) => ({
    style: { ...S.input, ...(field === 'title' && personalInfo.title ? { borderColor: '#1B3D6F' } : {}) },
    value: personalInfo[field] || '',
    onChange: e => updatePersonalInfo(field, e.target.value),
    onFocus: e => e.target.style.borderColor = '#1B3D6F',
    onBlur: e => e.target.style.borderColor = 'rgba(0,0,0,0.15)'
  })

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <div style={S.logo}>cv<span style={S.logoGold}>elite</span></div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Editor de CV</div>
      </div>

      <Section title="Informação Pessoal" defaultOpen={true}>
        <Field label="Nome completo"><input {...inp('name')} style={S.input} placeholder="Ex: João Silva" /></Field>
        <Field label={<>Título profissional {personalInfo.title?.length > 2 && <span style={S.titleBadge}>A procurar vagas...</span>}</>}
          onAI={() => onAIRequest('Sugere um título profissional impactante para o meu CV baseado na minha experiência')}>
          <input {...inp('title')} placeholder="Ex: Consultor Financeiro Sénior" />
        </Field>
        <Field label="Email"><input {...inp('email')} placeholder="joao@email.com" /></Field>
        <Field label="Telefone"><input {...inp('phone')} placeholder="+351 912 345 678" /></Field>
        <Field label="Localização"><input {...inp('location')} placeholder="Lisboa, Portugal" /></Field>
        <Field label="LinkedIn"><input {...inp('linkedin')} placeholder="linkedin.com/in/joaosilva" /></Field>
      </Section>

      <Section title="Sumário Profissional">
        <Field label="Sumário" onAI={() => onAIRequest('Analisa o meu CV e escreve um sumário profissional de alto impacto de 3-4 frases, com linguagem de topo e keywords ATS. Inclui uma sugestão no formato <suggestion>.')}>
          <textarea style={S.textarea} value={personalInfo.summary || ''} onChange={e => updatePersonalInfo('summary', e.target.value)} placeholder="Escreve o teu sumário ou usa a IA para gerar..." />
        </Field>
      </Section>

      <Section title="Experiência Profissional">
        {experience.map((exp, ei) => (
          <div key={exp.id} style={{ ...S.card, animation: 'slide-in .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Experiência {ei + 1}</span>
              <button style={S.trashBtn} onClick={() => removeExperience(exp.id)}><Trash2 size={13} /></button>
            </div>
            <Field label="Cargo" onAI={() => onAIRequest(`Para o cargo "${exp.role || 'indicado'}" na empresa "${exp.company || 'indicada'}", sugere um título de cargo mais impactante para CV de top-tier. Inclui sugestão no formato <suggestion>.`)}>
              <input style={S.input} value={exp.role} onChange={e => updateExperience(exp.id, 'role', e.target.value)} placeholder="Ex: Senior Financial Analyst" />
            </Field>
            <Field label="Empresa">
              <input style={S.input} value={exp.company} onChange={e => updateExperience(exp.id, 'company', e.target.value)} placeholder="Ex: Deloitte Portugal" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Início"><input style={S.input} value={exp.startDate} onChange={e => updateExperience(exp.id, 'startDate', e.target.value)} placeholder="Jan 2022" /></Field>
              <Field label="Fim"><input style={S.input} value={exp.endDate} onChange={e => updateExperience(exp.id, 'endDate', e.target.value)} placeholder="Presente" disabled={exp.current} /></Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={exp.current} onChange={e => updateExperience(exp.id, 'current', e.target.checked)} />
              Cargo actual
            </label>
            <div style={{ marginTop: 10 }}>
              <div style={S.label}>
                <span>Responsabilidades</span>
                <button style={S.aiBtn} onClick={() => onAIRequest(`Para o cargo "${exp.role || 'indicado'}" na empresa "${exp.company || 'indicada'}", gera 4-5 bullets de responsabilidades quantificadas (com números, %, €) no formato de CV de Wall Street/Big Four. Inclui uma sugestão por bullet.`)}>
                  <Wand2 size={12} />
                </button>
              </div>
              {exp.bullets.map((b, bi) => (
                <div key={bi} style={S.bulletRow}>
                  <span style={{ color: '#C9A84C', marginTop: 9, flexShrink: 0, fontSize: 14 }}>•</span>
                  <textarea style={{ ...S.textarea, minHeight: 44, marginTop: 4 }}
                    value={b} onChange={e => updateBullet(exp.id, bi, e.target.value)}
                    placeholder="Ex: Liderou equipa de 8 analistas, aumentando produtividade em 34%..." />
                  <button style={S.aiBtn} title="Melhorar bullet com IA"
                    onClick={() => onAIRequest(`Melhora este bullet de CV com linguagem de alto impacto, adiciona quantificação e keywords ATS: "${b}". Inclui a versão melhorada como sugestão no formato <suggestion>.`)}>
                    <Wand2 size={11} />
                  </button>
                  <button style={{ ...S.trashBtn, marginLeft: 0 }} onClick={() => removeBullet(exp.id, bi)}><Trash2 size={11} /></button>
                </div>
              ))}
              <button style={{ ...S.addBtn, marginTop: 6 }} onClick={() => addBullet(exp.id)}>
                <Plus size={12} /> Bullet
              </button>
            </div>
          </div>
        ))}
        <button style={S.addBtn} onClick={addExperience}><Plus size={13} /> Adicionar experiência</button>
      </Section>

      <Section title="Educação">
        {education.map((edu, i) => (
          <div key={edu.id} style={{ ...S.card, animation: 'slide-in .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Educação {i + 1}</span>
              <button style={S.trashBtn} onClick={() => removeEducation(edu.id)}><Trash2 size={13} /></button>
            </div>
            <Field label="Instituição"><input style={S.input} value={edu.institution} onChange={e => updateEducation(edu.id, 'institution', e.target.value)} placeholder="Ex: Universidade Nova de Lisboa" /></Field>
            <Field label="Grau"><input style={S.input} value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} placeholder="Ex: Licenciatura, Mestrado" /></Field>
            <Field label="Área"><input style={S.input} value={edu.field} onChange={e => updateEducation(edu.id, 'field', e.target.value)} placeholder="Ex: Gestão Financeira" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Ano"><input style={S.input} value={edu.year} onChange={e => updateEducation(edu.id, 'year', e.target.value)} placeholder="2022" /></Field>
              <Field label="GPA/Média"><input style={S.input} value={edu.gpa} onChange={e => updateEducation(edu.id, 'gpa', e.target.value)} placeholder="17 / 20" /></Field>
            </div>
          </div>
        ))}
        <button style={S.addBtn} onClick={addEducation}><Plus size={13} /> Adicionar educação</button>
      </Section>

      <Section title="Competências">
        {skills.map((sk, i) => (
          <div key={sk.id} style={{ ...S.card, animation: 'slide-in .2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Categoria {i + 1}</span>
              <button style={S.trashBtn} onClick={() => removeSkillCategory(sk.id)}><Trash2 size={13} /></button>
            </div>
            <Field label="Categoria"><input style={S.input} value={sk.category} onChange={e => updateSkillCategory(sk.id, 'category', e.target.value)} placeholder="Ex: Software & Ferramentas" /></Field>
            <Field label="Competências (separadas por vírgula)"
              onAI={() => onAIRequest(`Sugere 6-8 competências técnicas de alto valor para a categoria "${sk.category || 'indicada'}" num CV de Wall Street/Big Four. Lista separada por vírgulas.`)}>
              <input style={S.input} value={(sk.items || []).join(', ')} onChange={e => updateSkillCategory(sk.id, 'items', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Excel avançado, Bloomberg, Python, SQL..." />
            </Field>
          </div>
        ))}
        <button style={S.addBtn} onClick={addSkillCategory}><Plus size={13} /> Adicionar categoria</button>
      </Section>
    </div>
  )
}
