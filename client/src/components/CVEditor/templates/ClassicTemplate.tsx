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
  return `${s} – ${e}`
}

export default function ClassicTemplate() {
  const store = useCVStore()
  const { personal, summary, experience, education, skills, languages, certifications, customSections, sectionOrder, fontFamily, fontSize, lineSpacing } = store

  const lh = lineSpacing === 'compact' ? 1.3 : lineSpacing === 'spacious' ? 1.9 : 1.6
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
    <div style={{ fontFamily: ff, fontSize, color: '#1a1a1a', padding: '32px 40px', background: '#fff', lineHeight: lh, minHeight: '100%' }}>
      {/* Header - centered */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: fontSize + 10, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          {personal.fullName || 'Nome Completo'}
        </h1>
        {personal.jobTitle && (
          <div style={{ fontSize: fontSize + 1, color: '#374151', marginBottom: 6, fontWeight: 500 }}>
            {personal.jobTitle}
          </div>
        )}
        <div style={{ fontSize: fontSize - 1, color: '#6b7280', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 12px' }}>
          {[personal.email, personal.phone, personal.address, personal.linkedin, personal.website,
            personal.showNationality ? personal.nationality : '',
            personal.showBirthDate ? personal.birthDate : '',
          ].filter(Boolean).join('  |  ')}
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
                    <span style={{ fontSize: fontSize - 1, color: '#6b7280' }}>{fmtDateRange(edu.startDate, edu.endDate, false)}</span>
                  </div>
                  <div style={{ color: '#374151', fontStyle: 'italic' }}>{edu.institution}</div>
                  {edu.description && <div style={{ marginTop: 2, color: '#374151' }}>{edu.description}</div>}
                </div>
              ))}
            </div>
          )
        }
        if (key === 'skills' && skills.length > 0) {
          return (
            <div key="skills" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Competências</h2>
              <p style={{ margin: 0, color: '#374151', lineHeight: lh }}>
                {skills.map(sk => sk.name).join(' · ')}
              </p>
            </div>
          )
        }
        if (key === 'languages' && languages.length > 0) {
          return (
            <div key="languages" style={{ marginBottom: 16 }}>
              <h2 style={secTitle}>Idiomas</h2>
              <p style={{ margin: 0, color: '#374151' }}>
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
                    <strong style={{ color: '#111827' }}>{cert.name}</strong>
                    {cert.issuer && <span style={{ color: '#6b7280' }}> — {cert.issuer}</span>}
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
