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

export default function ModernTemplate() {
  const store = useCVStore()
  const { personal, summary, experience, education, skills, languages, certifications, customSections, sectionOrder, primaryColor, fontFamily, fontSize, lineSpacing } = store

  const lh = lineSpacing === 'compact' ? 1.3 : lineSpacing === 'spacious' ? 1.9 : 1.6
  const ff = fontFamily === 'Inter' ? "'Inter', sans-serif" : fontFamily === 'Georgia' ? 'Georgia, serif' : fontFamily === 'Merriweather' ? "'Merriweather', Georgia, serif" : fontFamily === 'Roboto' ? "'Roboto', sans-serif" : "'Playfair Display', Georgia, serif"

  const sidebarSecTitle: React.CSSProperties = {
    fontSize: fontSize + 1,
    fontWeight: 700,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: '1px solid rgba(255,255,255,0.3)',
  }

  const mainSecTitle: React.CSSProperties = {
    fontSize: fontSize + 2,
    fontWeight: 700,
    color: primaryColor,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `2px solid ${primaryColor}`,
  }

  return (
    <div style={{ fontFamily: ff, fontSize, color: '#1a1a1a', display: 'flex', minHeight: '100%', background: '#fff' }}>
      {/* Sidebar */}
      <div style={{ width: '30%', background: primaryColor, color: '#fff', padding: '28px 18px', flexShrink: 0 }}>
        {/* Photo + Name */}
        {personal.photo && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src={personal.photo} alt="foto" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.5)' }} />
          </div>
        )}
        <h1 style={{ fontSize: fontSize + 6, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 4, textAlign: personal.photo ? 'center' : 'left' }}>
          {personal.fullName || 'Nome Completo'}
        </h1>
        {personal.jobTitle && (
          <p style={{ fontSize: fontSize, color: 'rgba(255,255,255,0.8)', marginBottom: 20, textAlign: personal.photo ? 'center' : 'left', fontWeight: 500 }}>
            {personal.jobTitle}
          </p>
        )}

        {/* Contacts */}
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {personal.email && <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-all' }}>{personal.email}</span>}
          {personal.phone && <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.85)' }}>{personal.phone}</span>}
          {personal.address && <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.85)' }}>{personal.address}</span>}
          {personal.linkedin && <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-all' }}>{personal.linkedin}</span>}
          {personal.website && <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-all' }}>{personal.website}</span>}
          {personal.showNationality && personal.nationality && <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.85)' }}>{personal.nationality}</span>}
          {personal.showBirthDate && personal.birthDate && <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.85)' }}>{personal.birthDate}</span>}
        </div>

        {/* Skills in sidebar */}
        {skills.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={sidebarSecTitle}>Competências</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {skills.map(sk => (
                <div key={sk.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.9)' }}>{sk.name}</span>
                    <span style={{ fontSize: fontSize - 2, color: 'rgba(255,255,255,0.6)' }}>{sk.level}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 2,
                      background: '#fff',
                      width: sk.level === 'Expert' ? '100%' : sk.level === 'Avançado' ? '75%' : sk.level === 'Intermédio' ? '50%' : '25%',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Languages in sidebar */}
        {languages.length > 0 && (
          <div>
            <div style={sidebarSecTitle}>Idiomas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {languages.map(lang => (
                <div key={lang.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.9)' }}>{lang.name}</span>
                  <span style={{ fontSize: fontSize - 1, color: 'rgba(255,255,255,0.6)' }}>{lang.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '28px 24px', lineHeight: lh }}>
        {sectionOrder.map(key => {
          if (key === 'personal' || key === 'skills' || key === 'languages') return null

          if (key === 'summary' && summary) {
            return (
              <div key="summary" style={{ marginBottom: 20 }}>
                <div style={mainSecTitle}>Sobre Mim</div>
                <p style={{ color: '#374151', fontSize, lineHeight: lh }}>{summary}</p>
              </div>
            )
          }
          if (key === 'experience' && experience.length > 0) {
            return (
              <div key="experience" style={{ marginBottom: 20 }}>
                <div style={mainSecTitle}>Experiência</div>
                {experience.map((exp, i) => (
                  <div key={exp.id} style={{ marginBottom: i < experience.length - 1 ? 14 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: fontSize + 1, color: '#111827' }}>{exp.role}</div>
                        <div style={{ color: primaryColor, fontSize, fontWeight: 600 }}>{exp.company}{exp.location ? ` · ${exp.location}` : ''}</div>
                      </div>
                      <div style={{ fontSize: fontSize - 1, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>
                        {fmtDateRange(exp.startDate, exp.endDate, exp.current)}
                      </div>
                    </div>
                    {exp.description && <div style={{ marginTop: 4, color: '#374151', fontSize, lineHeight: lh, whiteSpace: 'pre-line' }}>{exp.description}</div>}
                  </div>
                ))}
              </div>
            )
          }
          if (key === 'education' && education.length > 0) {
            return (
              <div key="education" style={{ marginBottom: 20 }}>
                <div style={mainSecTitle}>Formação</div>
                {education.map((edu, i) => (
                  <div key={edu.id} style={{ marginBottom: i < education.length - 1 ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: fontSize + 1, color: '#111827' }}>{edu.degree}{edu.field ? `, ${edu.field}` : ''}</div>
                        <div style={{ color: primaryColor, fontSize, fontWeight: 600 }}>{edu.institution}</div>
                      </div>
                      <div style={{ fontSize: fontSize - 1, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{fmtDateRange(edu.startDate, edu.endDate, false)}</div>
                    </div>
                    {edu.description && <div style={{ marginTop: 3, color: '#374151', fontSize }}>{edu.description}</div>}
                  </div>
                ))}
              </div>
            )
          }
          if (key === 'certifications' && certifications.length > 0) {
            return (
              <div key="certifications" style={{ marginBottom: 20 }}>
                <div style={mainSecTitle}>Certificações</div>
                {certifications.map(cert => (
                  <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
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
              <div key={key} style={{ marginBottom: 20 }}>
                <div style={mainSecTitle}>{cs.title}</div>
                <p style={{ color: '#374151', fontSize, lineHeight: lh, whiteSpace: 'pre-line' }}>{cs.content}</p>
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}
