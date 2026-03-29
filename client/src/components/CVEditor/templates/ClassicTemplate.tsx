import React from 'react'
import { useCVStore } from '../../../store/cvStore'

function firstLast(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return name
  return `${parts[0]} ${parts[parts.length - 1]}`
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m] = d.split('-')
  if (!m) return y
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[parseInt(m) - 1]} ${y}`
}

function fmtDateRange(start: string, end: string, current: boolean) {
  const s = fmtDate(start)
  const e = current ? 'Presente' : fmtDate(end)
  if (!s && !e) return ''
  if (!e) return s
  return `${s} – ${e}`
}

function fmtLinkedin(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
}

const IcoEmail = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IcoPhone = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M3 2h3l1 3.5-1.5 1.5a9 9 0 004.5 4.5L11.5 10l3.5 1V14a1 1 0 01-1 1C5.4 15 1 10.6 1 3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoLocation = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M8 1.5A4.5 4.5 0 0112.5 6c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 018 1.5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
const IcoLinkedIn = () => <svg width="9" height="9" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}><rect width="16" height="16" rx="2" fill="currentColor"/><rect x="3" y="6" width="2.2" height="6.5" fill="white"/><circle cx="4.1" cy="3.9" r="1.3" fill="white"/><path d="M8 6h1.8v.9a2.5 2.5 0 014.2 1.9V12.5H12V9.1a1 1 0 00-1-1 1 1 0 00-1 1v3.4H8V6z" fill="white"/></svg>

export default function ClassicTemplate() {
  const store = useCVStore()
  const { personal, summary, experience, education, skills, languages, certifications, customSections, sectionOrder, fontFamily, fontSize, lineSpacing } = store

  const lh = lineSpacing === 'compact' ? 1.3 : lineSpacing === 'spacious' ? 1.9 : 1.6
  const smallFs = 9
  const ff = fontFamily === 'Inter' ? "'Inter', sans-serif" : fontFamily === 'Georgia' ? 'Georgia, serif' : fontFamily === 'Merriweather' ? "'Merriweather', Georgia, serif" : fontFamily === 'Roboto' ? "'Roboto', sans-serif" : "'Playfair Display', Georgia, serif"

  const secTitle: React.CSSProperties = {
    fontSize: fontSize + 1,
    fontWeight: 700,
    color: '#111827',
    textDecoration: 'underline',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 8,
    marginTop: 0,
  }

  return (
    <div style={{ fontFamily: ff, fontSize, color: '#1a1a1a', padding: '75px 75px 75px 38px', background: '#fff', lineHeight: lh, minHeight: '100%' }}>
      {/* Header - centered */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: fontSize + 10, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          {firstLast(personal.fullName) || 'Nome Completo'}
        </h1>
        {personal.jobTitle && (
          <div style={{ fontSize: fontSize + 1, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
            {personal.jobTitle}
          </div>
        )}
        <div style={{ fontSize: fontSize - 1, color: '#6b7280', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 14px' }}>
          {personal.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoEmail />{personal.email}</span>}
          {personal.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoPhone />{personal.phone}</span>}
          {personal.address && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoLocation />{personal.address}</span>}
          {personal.linkedin && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoLinkedIn />{fmtLinkedin(personal.linkedin)}</span>}
          {personal.website && <span>{personal.website}</span>}
          {personal.showNationality && personal.nationality && <span>{personal.nationality}</span>}
          {personal.showBirthDate && personal.birthDate && <span>{personal.birthDate}</span>}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #111827', marginBottom: 16 }} />

      {sectionOrder.map(key => {
        if (key === 'personal') return null

        if (key === 'summary' && summary) {
          return (
            <div key="summary" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Resumo</h2>
              <p style={{ color: '#374151', margin: 0, lineHeight: lh }}>{summary}</p>
            </div>
          )
        }
        if (key === 'experience' && experience.length > 0) {
          return (
            <div key="experience" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Experiência Profissional</h2>
              {experience.map((exp, i) => (
                <div key={exp.id} style={{ marginBottom: i < experience.length - 1 ? 12 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: fontSize + 1, color: '#111827' }}>{exp.role}</strong>
                    <span style={{ fontSize: fontSize - 1, color: '#6b7280' }}>{fmtDateRange(exp.startDate, exp.endDate, exp.current)}</span>
                  </div>
                  <div style={{ color: '#374151', fontStyle: 'italic' }}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</div>
                  {exp.description && <div style={{ marginTop: 3, color: '#374151', whiteSpace: 'pre-line', lineHeight: lh }}>{exp.description}</div>}
                </div>
              ))}
            </div>
          )
        }
        if (key === 'education' && education.length > 0) {
          return (
            <div key="education" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Formação Académica</h2>
              {education.map((edu, i) => (
                <div key={edu.id} style={{ marginBottom: i < education.length - 1 ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: fontSize + 1, color: '#111827' }}>{edu.degree}{edu.field ? `, ${edu.field}` : ''}</strong>
                    <span style={{ fontSize: fontSize - 1, color: '#6b7280' }}>{fmtDateRange(edu.startDate, edu.endDate, edu.current ?? false)}</span>
                  </div>
                  <div style={{ fontSize: smallFs, color: '#374151', fontStyle: 'italic' }}>{edu.institution}</div>
                  {edu.description && <div style={{ fontSize: smallFs, marginTop: 2, color: '#374151' }}>{edu.description}</div>}
                </div>
              ))}
            </div>
          )
        }
        if (key === 'skills' && skills.length > 0) {
          return (
            <div key="skills" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Competências</h2>
              <p style={{ margin: 0, fontSize: smallFs, color: '#374151', lineHeight: lh }}>
                {skills.map(sk => sk.name).join(' · ')}
              </p>
            </div>
          )
        }
        if (key === 'languages' && languages.length > 0) {
          return (
            <div key="languages" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Idiomas</h2>
              <p style={{ margin: 0, fontSize: smallFs, color: '#374151' }}>
                {languages.map(l => `${l.name} (${l.level})`).join(' · ')}
              </p>
            </div>
          )
        }
        if (key === 'certifications' && certifications.length > 0) {
          return (
            <div key="certifications" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Certificações</h2>
              {certifications.map(cert => (
                <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>
                    <strong style={{ fontSize: smallFs, color: '#111827' }}>{cert.name}</strong>
                    {cert.issuer && <span style={{ fontSize: smallFs, color: '#6b7280' }}> — {cert.issuer}</span>}
                  </span>
                  {cert.date && <span style={{ fontSize: fontSize - 1, color: '#9ca3af' }}>{fmtDate(cert.date)}</span>}
                </div>
              ))}
            </div>
          )
        }
        if (key.startsWith('custom_')) {
          const id = key.replace('custom_', '')
          const cs = customSections.find(s => s.id === id)
          if (!cs || !cs.content) return null
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>{cs.title}</h2>
              <p style={{ margin: 0, color: '#374151', whiteSpace: 'pre-line', lineHeight: lh }}>{cs.content}</p>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
