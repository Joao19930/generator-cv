import React, { useEffect } from 'react'
import { useCVStore } from '../../../store/cvStore'

const POPPINS_INJECTED_KEY = '__poppins_injected__'

function injectPoppins() {
  if ((window as any)[POPPINS_INJECTED_KEY]) return
  const style = document.createElement('style')
  style.textContent = "@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');"
  document.head.appendChild(style)
  ;(window as any)[POPPINS_INJECTED_KEY] = true
}

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m] = d.split('-')
  if (!m) return y
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[parseInt(m) - 1]} ${y}`
}

function fmtDateRange(start: string, end: string, current: boolean): string {
  const s = fmtDate(start)
  const e = current ? 'Presente' : fmtDate(end)
  if (!s && !e) return ''
  if (!e) return s
  return `${s} — ${e}`
}

export default function ModernTemplate() {
  const store = useCVStore()
  const {
    personal,
    summary,
    experience,
    education,
    skills,
    languages,
    certifications,
    customSections,
    sectionOrder,
    primaryColor,
    fontSize,
    lineSpacing,
    habilidades,
    cursos,
    interesses,
  } = store

  useEffect(() => {
    injectPoppins()
  }, [])

  const lh = lineSpacing === 'compact' ? 1.3 : lineSpacing === 'spacious' ? 1.9 : 1.6
  const fs = fontSize // base font size from store (default 11)
  const smallFs = 9   // education, skills, languages, certifications

  const sidebarSecTitleStyle: React.CSSProperties = {
    fontSize: fs - 1,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: primaryColor,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid #edebe7',
  }

  const mainSecTitleStyle: React.CSSProperties = {
    fontSize: fs,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: primaryColor,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid #edebe7',
  }

  function renderSidebarSection(key: string): React.ReactNode {
    if (key === 'education' && education.length > 0) {
      return (
        <div key="education" style={{ marginBottom: 16 }}>
          <div style={sidebarSecTitleStyle}>Formação</div>
          {education.map((edu, i) => (
            <div key={edu.id} style={{ marginBottom: i < education.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: fs + 1, fontWeight: 700, color: '#111827' }}>
                {edu.degree}{edu.field ? `, ${edu.field}` : ''}
              </div>
              <div style={{ fontSize: smallFs, fontWeight: 600, color: primaryColor }}>{edu.institution}</div>
              <div style={{ fontSize: smallFs, color: '#6b7280' }}>
                {fmtDateRange(edu.startDate, edu.endDate, false)}
              </div>
              {edu.description && (
                <div style={{ fontSize: smallFs, fontWeight: 300, color: '#374151', lineHeight: lh, marginTop: 2 }}>
                  {edu.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    if (key === 'skills' && skills.length > 0) {
      return (
        <div key="skills" style={{ marginBottom: 16 }}>
          <div style={sidebarSecTitleStyle}>Competências</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {skills.map(sk => (
              <div key={sk.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: smallFs, color: '#374151', fontWeight: 500 }}>{sk.name}</span>
                  <span style={{ fontSize: smallFs, color: '#9ca3af' }}>{sk.level}</span>
                </div>
                <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2 }}>
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
        <div key="languages" style={{ marginBottom: 16 }}>
          <div style={sidebarSecTitleStyle}>Idiomas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {languages.map(lang => (
              <div key={lang.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: smallFs, fontWeight: 500, color: '#374151' }}>{lang.name}</span>
                <span style={{ fontSize: smallFs, color: '#9ca3af' }}>{lang.level}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return null
  }

  function renderSidebarExtra(): React.ReactNode {
    return (
      <>
        {habilidades.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={sidebarSecTitleStyle}>Habilidades Técnicas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {habilidades.map(h => (
                <div key={h.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: smallFs, color: '#374151', fontWeight: 500 }}>{h.name}</span>
                  </div>
                  <div style={{ height: 3, background: '#e5e7eb', borderRadius: 2 }}>
                    <div style={{
                      height: '100%',
                      borderRadius: 2,
                      background: primaryColor,
                      width: h.level === 'Expert' ? '95%' : h.level === 'Avançado' ? '80%' : h.level === 'Intermédio' ? '60%' : '40%',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cursos.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={sidebarSecTitleStyle}>Cursos</div>
            {cursos.slice(0, 5).map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                <span style={{ color: primaryColor, fontSize: fs, fontWeight: 700, flexShrink: 0 }}>–</span>
                <span style={{ fontSize: fs - 1, color: '#374151', lineHeight: 1.4 }}>{c}</span>
              </div>
            ))}
            {cursos.length > 5 && (
              <div style={{ fontSize: fs - 1, color: '#9ca3af', marginTop: 2 }}>+{cursos.length - 5} mais</div>
            )}
          </div>
        )}

        {interesses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={sidebarSecTitleStyle}>Interesses</div>
            {interesses.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                <span style={{ color: primaryColor, fontSize: fs, fontWeight: 700, flexShrink: 0 }}>–</span>
                <span style={{ fontSize: fs - 1, color: '#374151', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  function renderMainSection(key: string): React.ReactNode {
    if (key === 'personal' || key === 'education' || key === 'skills' || key === 'languages') return null

    if (key === 'summary' && summary) {
      return (
        <div key="summary" style={{ marginBottom: 16 }}>
          <div style={mainSecTitleStyle}>Sobre Mim</div>
          <div style={{
            borderLeft: `1.5px solid ${primaryColor}`,
            paddingLeft: 10,
            fontSize: fs,
            fontWeight: 300,
            color: '#374151',
            lineHeight: 1.6,
          }}>
            {summary}
          </div>
        </div>
      )
    }

    if (key === 'experience' && experience.length > 0) {
      return (
        <div key="experience" style={{ marginBottom: 16 }}>
          <div style={mainSecTitleStyle}>Experiência Profissional</div>
          {experience.map((exp, i) => (
            <div key={exp.id} style={{ display: 'flex', gap: 12, marginBottom: i < experience.length - 1 ? 14 : 0 }}>
              {/* Timeline dot + line */}
              <div style={{ flexShrink: 0, paddingTop: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#fff',
                  border: `1.5px solid ${primaryColor}`,
                  flexShrink: 0,
                }} />
                {i < experience.length - 1 && (
                  <div style={{
                    width: 1.5,
                    flex: 1,
                    background: `${primaryColor}40`,
                    marginTop: 2,
                    minHeight: 20,
                  }} />
                )}
              </div>
              {/* Content */}
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: fs + 2, color: '#111827' }}>{exp.role}</div>
                <div style={{ fontWeight: 600, fontSize: fs + 1, color: primaryColor }}>
                  {exp.company}{exp.location ? ` · ${exp.location}` : ''}
                </div>
                <div style={{ fontSize: fs - 1, color: '#6b7280', marginBottom: 3 }}>
                  {fmtDateRange(exp.startDate, exp.endDate, exp.current)}
                </div>
                {exp.description && (
                  <div style={{ marginTop: 4, fontSize: fs, fontWeight: 300, color: '#374151', lineHeight: 1.5 }}>
                    {exp.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (key === 'certifications' && certifications.length > 0) {
      return (
        <div key="certifications" style={{ marginBottom: 16 }}>
          <div style={mainSecTitleStyle}>Certificações</div>
          {certifications.map(cert => (
            <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: smallFs, color: '#111827' }}>{cert.name}</span>
                {cert.issuer && <span style={{ color: '#6b7280', fontSize: smallFs }}> — {cert.issuer}</span>}
              </div>
              {cert.date && (
                <span style={{ fontSize: smallFs, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>
                  {fmtDate(cert.date)}
                </span>
              )}
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
          <div style={mainSecTitleStyle}>{cs.title}</div>
          <p style={{ fontSize: fs, fontWeight: 300, color: '#374151', lineHeight: lh, margin: 0, whiteSpace: 'pre-line' }}>
            {cs.content}
          </p>
        </div>
      )
    }

    return null
  }

  return (
    <div style={{
      width: 794,
      minHeight: 1123,
      fontFamily: "'Poppins', sans-serif",
      background: '#fff',
    }}>
      {/* HEADER */}
      <header style={{
        padding: '75px 75px 20px',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}>
        {personal.photo && (
          <img
            src={personal.photo}
            alt="foto"
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `1.5px solid ${primaryColor}`,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: fs + 12,
            fontWeight: 700,
            color: '#111827',
            fontFamily: "'Poppins', sans-serif",
            margin: 0,
            lineHeight: 1.2,
          }}>
            {personal.fullName || 'Nome Completo'}
          </h1>
          {personal.jobTitle && (
            <p style={{
              fontSize: fs - 1,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '2.8px',
              color: primaryColor,
              margin: '4px 0 8px',
            }}>
              {personal.jobTitle}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontSize: fs, color: '#6b7280' }}>
            {personal.email && <span>{personal.email}</span>}
            {personal.phone && <span>{personal.phone}</span>}
            {personal.address && <span>{personal.address}</span>}
            {personal.linkedin && <span>{personal.linkedin}</span>}
            {personal.website && <span>{personal.website}</span>}
            {personal.showNationality && personal.nationality && <span>{personal.nationality}</span>}
            {personal.showBirthDate && personal.birthDate && <span>{personal.birthDate}</span>}
          </div>
        </div>
      </header>

      {/* Gradient accent line */}
      <div style={{
        height: 1.5,
        background: `linear-gradient(90deg, ${primaryColor}, transparent)`,
        margin: '0 36px',
      }} />

      {/* TWO-COLUMN BODY */}
      <div style={{ display: 'flex', marginTop: 0 }}>
        {/* Sidebar */}
        <aside style={{
          width: 230,
          background: '#fafaf9',
          padding: '20px 16px 75px 75px',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}>
          {sectionOrder.map(key => renderSidebarSection(key))}
          {renderSidebarExtra()}
        </aside>

        {/* Main */}
        <main style={{
          flex: 1,
          padding: '20px 75px 75px 24px',
          boxSizing: 'border-box',
        }}>
          {sectionOrder.map(key => renderMainSection(key))}
        </main>
      </div>
    </div>
  )
}
