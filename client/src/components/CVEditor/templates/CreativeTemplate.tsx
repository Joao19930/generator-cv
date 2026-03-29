import React from 'react' // eslint-disable-line @typescript-eslint/no-unused-vars
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
  return `${s} — ${e}`
}

function fmtLinkedin(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
}

const IcoEmail = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
const IcoPhone = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M3 2h3l1 3.5-1.5 1.5a9 9 0 004.5 4.5L11.5 10l3.5 1V14a1 1 0 01-1 1C5.4 15 1 10.6 1 3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoLocation = () => <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M8 1.5A4.5 4.5 0 0112.5 6c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 018 1.5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
const IcoLinkedIn = () => <svg width="9" height="9" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 1 }}><rect width="16" height="16" rx="2" fill="currentColor"/><rect x="3" y="6" width="2.2" height="6.5" fill="white"/><circle cx="4.1" cy="3.9" r="1.3" fill="white"/><path d="M8 6h1.8v.9a2.5 2.5 0 014.2 1.9V12.5H12V9.1a1 1 0 00-1-1 1 1 0 00-1 1v3.4H8V6z" fill="white"/></svg>

export default function CreativeTemplate() {
  const store = useCVStore()
  const { personal, summary, experience, education, skills, languages, certifications, customSections, sectionOrder, primaryColor, fontFamily, fontSize, lineSpacing } = store

  const lh = lineSpacing === 'compact' ? 1.3 : lineSpacing === 'spacious' ? 1.9 : 1.6
  const smallFs = 9
  const ff = fontFamily === 'Inter' ? "'Inter', sans-serif" : fontFamily === 'Georgia' ? 'Georgia, serif' : fontFamily === 'Merriweather' ? "'Merriweather', Georgia, serif" : fontFamily === 'Roboto' ? "'Roboto', sans-serif" : "'Playfair Display', Georgia, serif"

  const sectionTitle = (text: string) => (
    <div style={{
      fontSize: fontSize + 2,
      fontWeight: 700,
      color: primaryColor,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      marginBottom: 10,
      paddingLeft: 10,
      borderLeft: `4px solid ${primaryColor}`,
      lineHeight: 1.2,
    }}>
      {text}
    </div>
  )

  const leftSections = ['skills', 'languages', 'certifications']
  const rightSections = ['summary', 'experience', 'education']

  function renderLeft(key: string) {
    if (key === 'skills' && skills.length > 0) {
      return (
        <div key="skills" style={{ marginBottom: 20 }}>
          {sectionTitle('Competências')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {skills.map(sk => (
              <div key={sk.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: smallFs, color: '#111827', fontWeight: 500 }}>{sk.name}</span>
                  <span style={{ fontSize: smallFs, color: '#6b7280' }}>{sk.level}</span>
                </div>
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 2,
                    background: primaryColor,
                    width: sk.level === 'Expert' ? '100%' : sk.level === 'Avançado' ? '75%' : sk.level === 'Intermédio' ? '50%' : '25%',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (key === 'languages' && languages.length > 0) {
      return (
        <div key="languages" style={{ marginBottom: 20 }}>
          {sectionTitle('Idiomas')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {languages.map(lang => (
              <div key={lang.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: smallFs, color: '#111827' }}>{lang.name}</span>
                <span style={{
                  fontSize: smallFs,
                  padding: '1px 8px',
                  background: `${primaryColor}15`,
                  color: primaryColor,
                  borderRadius: 10,
                  fontWeight: 600,
                }}>
                  {lang.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (key === 'certifications' && certifications.length > 0) {
      return (
        <div key="certifications" style={{ marginBottom: 20 }}>
          {sectionTitle('Certificações')}
          {certifications.map(cert => (
            <div key={cert.id} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: smallFs, color: '#111827' }}>{cert.name}</div>
              {cert.issuer && <div style={{ fontSize: smallFs, color: '#6b7280' }}>{cert.issuer}</div>}
              {cert.date && <div style={{ fontSize: smallFs, color: '#9ca3af' }}>{fmtDate(cert.date)}</div>}
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
        <div key={key} style={{ marginBottom: 20 }}>
          {sectionTitle(cs.title)}
          <p style={{ fontSize, color: '#374151', lineHeight: lh, whiteSpace: 'pre-line' }}>{cs.content}</p>
        </div>
      )
    }
    return null
  }

  function renderRight(key: string) {
    if (key === 'summary' && summary) {
      return (
        <div key="summary" style={{ marginBottom: 20 }}>
          {sectionTitle('Sobre Mim')}
          <p style={{ fontSize, color: '#374151', lineHeight: lh, margin: 0 }}>{summary}</p>
        </div>
      )
    }
    if (key === 'experience' && experience.length > 0) {
      return (
        <div key="experience" style={{ marginBottom: 20 }}>
          {sectionTitle('Experiência')}
          {experience.map((exp, i) => (
            <div key={exp.id} style={{ marginBottom: i < experience.length - 1 ? 14 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: fontSize + 1, color: '#111827' }}>{exp.role}</div>
                  <div style={{ color: primaryColor, fontWeight: 600, fontSize }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                </div>
                <div style={{ fontSize: fontSize - 1, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>
                  {fmtDateRange(exp.startDate, exp.endDate, exp.current)}
                </div>
              </div>
              {exp.description && <div style={{ marginTop: 4, fontSize, color: '#374151', lineHeight: lh, whiteSpace: 'pre-line' }}>{exp.description}</div>}
            </div>
          ))}
        </div>
      )
    }
    if (key === 'education' && education.length > 0) {
      return (
        <div key="education" style={{ marginBottom: 20 }}>
          {sectionTitle('Formação')}
          {education.map((edu, i) => (
            <div key={edu.id} style={{ marginBottom: i < education.length - 1 ? 12 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: fontSize + 1, color: '#111827' }}>{edu.degree}{edu.field ? `, ${edu.field}` : ''}</div>
                  <div style={{ color: primaryColor, fontWeight: 600, fontSize: smallFs }}>{edu.institution}</div>
                </div>
                <div style={{ fontSize: smallFs, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{fmtDateRange(edu.startDate, edu.endDate, edu.current ?? false)}</div>
              </div>
              {edu.description && <div style={{ marginTop: 3, fontSize: smallFs, color: '#374151' }}>{edu.description}</div>}
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // Separate left vs right
  const leftKeys = sectionOrder.filter(k => leftSections.includes(k) || (k.startsWith('custom_') && !rightSections.includes(k)))
  const rightKeys = sectionOrder.filter(k => rightSections.includes(k))

  return (
    <div style={{ fontFamily: ff, fontSize, color: '#1a1a1a', background: '#fff', minHeight: '100%' }}>
      {/* Full-width colored header */}
      <div style={{ background: primaryColor, padding: '40px 75px 40px 38px', display: 'flex', alignItems: 'center', gap: 20 }}>
        {personal.photo && (
          <img src={personal.photo} alt="foto" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.6)', flexShrink: 0 }} />
        )}
        <div>
          <h1 style={{ fontSize: fontSize + 14, fontWeight: 700, color: '#fff', margin: '0 0 4px', lineHeight: 1.1 }}>
            {firstLast(personal.fullName) || 'Nome Completo'}
          </h1>
          {personal.jobTitle && (
            <div style={{ fontSize: fontSize + 2, color: 'rgba(255,255,255,0.85)', fontWeight: 400 }}>{personal.jobTitle}</div>
          )}
        </div>
      </div>

      {/* Contact bar */}
      <div style={{
        background: `${primaryColor}18`,
        padding: '8px 75px 8px 38px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '3px 20px',
        fontSize: fontSize - 1,
        color: '#374151',
        borderBottom: `1px solid ${primaryColor}30`,
      }}>
        {personal.email && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoEmail />{personal.email}</span>}
        {personal.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoPhone />{personal.phone}</span>}
        {personal.address && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoLocation />{personal.address}</span>}
        {personal.linkedin && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IcoLinkedIn />{fmtLinkedin(personal.linkedin)}</span>}
        {personal.website && <span>{personal.website}</span>}
        {personal.showNationality && personal.nationality && <span>{personal.nationality}</span>}
        {personal.showBirthDate && personal.birthDate && <span>{personal.birthDate}</span>}
      </div>

      {/* Two-column body */}
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Left 35% */}
        <div style={{ width: '35%', borderRight: `1px solid ${primaryColor}20`, padding: '24px 20px 75px 38px', flexShrink: 0 }}>
          {leftKeys.map(k => renderLeft(k))}
        </div>
        {/* Right 65% */}
        <div style={{ flex: 1, padding: '24px 75px 75px 20px', lineHeight: lh }}>
          {rightKeys.map(k => renderRight(k))}
        </div>
      </div>
    </div>
  )
}
