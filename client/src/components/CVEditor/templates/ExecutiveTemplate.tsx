import React from 'react'
import { useCVStore } from '../../../store/cvStore'

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

export default function ExecutiveTemplate() {
  const store = useCVStore()
  const { personal, summary, experience, education, skills, languages, certifications, customSections, sectionOrder, primaryColor, fontFamily, fontSize, lineSpacing } = store

  const lh = lineSpacing === 'compact' ? 1.3 : lineSpacing === 'spacious' ? 1.9 : 1.6

  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: fontSize + 3,
    fontWeight: 700,
    color: primaryColor,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: `2px solid ${primaryColor}`,
  }

  const bodyStyle: React.CSSProperties = {
    fontFamily: fontFamily === 'Inter' ? "'Inter', sans-serif" : fontFamily === 'Georgia' ? 'Georgia, serif' : fontFamily === 'Merriweather' ? "'Merriweather', Georgia, serif" : fontFamily === 'Roboto' ? "'Roboto', sans-serif" : "'Playfair Display', Georgia, serif",
    fontSize,
    lineHeight: lh,
    color: '#1a1a1a',
  }

  function renderSection(key: string) {
    if (key === 'personal') return null // rendered in header
    if (key === 'summary' && summary) {
      return (
        <div key="summary" style={sectionStyle}>
          <div style={sectionTitleStyle}>Resumo Profissional</div>
          <p style={{ ...bodyStyle, color: '#374151' }}>{summary}</p>
        </div>
      )
    }
    if (key === 'experience' && experience.length > 0) {
      return (
        <div key="experience" style={sectionStyle}>
          <div style={sectionTitleStyle}>Experiência Profissional</div>
          {experience.map((exp, i) => (
            <div key={exp.id} style={{ marginBottom: i < experience.length - 1 ? 14 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: fontSize + 1, color: '#111827' }}>{exp.role}</div>
                  <div style={{ fontWeight: 600, color: primaryColor, fontSize }}>{exp.company}{exp.location ? ` — ${exp.location}` : ''}</div>
                </div>
                <div style={{ fontSize: fontSize - 1, color: '#6b7280', flexShrink: 0, marginLeft: 8, fontStyle: 'italic' }}>
                  {fmtDateRange(exp.startDate, exp.endDate, exp.current)}
                </div>
              </div>
              {exp.description && (
                <div style={{ marginTop: 4, ...bodyStyle, color: '#374151', whiteSpace: 'pre-line' }}>
                  {exp.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }
    if (key === 'education' && education.length > 0) {
      return (
        <div key="education" style={sectionStyle}>
          <div style={sectionTitleStyle}>Formação Académica</div>
          {education.map((edu, i) => (
            <div key={edu.id} style={{ marginBottom: i < education.length - 1 ? 12 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: fontSize + 1, color: '#111827' }}>
                    {edu.degree}{edu.field ? `, ${edu.field}` : ''}
                  </div>
                  <div style={{ color: primaryColor, fontSize, fontWeight: 600 }}>{edu.institution}</div>
                </div>
                <div style={{ fontSize: fontSize - 1, color: '#6b7280', flexShrink: 0, marginLeft: 8, fontStyle: 'italic' }}>
                  {fmtDateRange(edu.startDate, edu.endDate, false)}
                </div>
              </div>
              {edu.description && <div style={{ marginTop: 3, ...bodyStyle, color: '#374151' }}>{edu.description}</div>}
            </div>
          ))}
        </div>
      )
    }
    if (key === 'skills' && skills.length > 0) {
      return (
        <div key="skills" style={sectionStyle}>
          <div style={sectionTitleStyle}>Competências</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {skills.map(sk => (
              <span key={sk.id} style={{
                padding: '3px 10px',
                background: `${primaryColor}15`,
                border: `1px solid ${primaryColor}30`,
                borderRadius: 20,
                fontSize: fontSize - 1,
                color: primaryColor,
                fontWeight: 500,
              }}>
                {sk.name}
              </span>
            ))}
          </div>
        </div>
      )
    }
    if (key === 'languages' && languages.length > 0) {
      return (
        <div key="languages" style={sectionStyle}>
          <div style={sectionTitleStyle}>Idiomas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
            {languages.map(lang => (
              <span key={lang.id} style={{ fontSize, color: '#374151' }}>
                <strong style={{ color: '#111827' }}>{lang.name}</strong> — {lang.level}
              </span>
            ))}
          </div>
        </div>
      )
    }
    if (key === 'certifications' && certifications.length > 0) {
      return (
        <div key="certifications" style={sectionStyle}>
          <div style={sectionTitleStyle}>Certificações</div>
          {certifications.map(cert => (
            <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize, color: '#111827' }}>{cert.name}</span>
                {cert.issuer && <span style={{ color: '#6b7280', fontSize }}> — {cert.issuer}</span>}
              </div>
              {cert.date && <span style={{ fontSize: fontSize - 1, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{fmtDate(cert.date)}</span>}
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
        <div key={key} style={sectionStyle}>
          <div style={sectionTitleStyle}>{cs.title}</div>
          <p style={{ ...bodyStyle, color: '#374151', whiteSpace: 'pre-line' }}>{cs.content}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ fontFamily: bodyStyle.fontFamily, fontSize, color: '#1a1a1a', padding: '32px 36px', background: '#fff', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24, paddingBottom: 20, borderBottom: `3px solid ${primaryColor}` }}>
        {personal.photo && (
          <img
            src={personal.photo}
            alt="foto"
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${primaryColor}` }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: fontSize + 12,
            fontWeight: 700,
            color: primaryColor,
            margin: 0,
            lineHeight: 1.2,
          }}>
            {personal.fullName || 'Nome Completo'}
          </h1>
          {personal.jobTitle && (
            <div style={{ fontSize: fontSize + 2, color: '#374151', marginTop: 4, fontWeight: 500 }}>
              {personal.jobTitle}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontSize: fontSize - 1, color: '#6b7280' }}>
            {personal.email && <span>{personal.email}</span>}
            {personal.phone && <span>{personal.phone}</span>}
            {personal.address && <span>{personal.address}</span>}
            {personal.linkedin && <span>{personal.linkedin}</span>}
            {personal.website && <span>{personal.website}</span>}
            {personal.showNationality && personal.nationality && <span>{personal.nationality}</span>}
            {personal.showBirthDate && personal.birthDate && <span>{personal.birthDate}</span>}
          </div>
        </div>
      </div>

      {/* Sections */}
      {sectionOrder.map(key => renderSection(key))}
    </div>
  )
}
