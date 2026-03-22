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

export default function ExecutiveTemplate() {
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

  function renderMainSection(key: string): React.ReactNode {
    if (key === 'personal') return null

    if (key === 'summary' && summary) {
      return (
        <div key="summary" style={{ marginBottom: 18 }}>
          <div style={mainSecTitleStyle}>Resumo Profissional</div>
          <p style={{ fontSize: fs, fontWeight: 300, color: '#374151', lineHeight: lh, margin: 0 }}>
            {summary}
          </p>
        </div>
      )
    }

    if (key === 'experience' && experience.length > 0) {
      return (
        <div key="experience" style={{ marginBottom: 18 }}>
          <div style={mainSecTitleStyle}>Experiência Profissional</div>
          {experience.map((exp, i) => (
            <div key={exp.id} style={{ marginBottom: i < experience.length - 1 ? 12 : 0 }}>
              <div style={{ fontSize: fs + 2, fontWeight: 700, color: '#111827' }}>{exp.role}</div>
              <div style={{ fontSize: fs + 1, fontWeight: 600, color: primaryColor }}>
                {exp.company}{exp.location ? ` — ${exp.location}` : ''}
              </div>
              <div style={{ fontSize: fs - 1, fontWeight: 400, color: '#6b7280', marginBottom: 3 }}>
                {fmtDateRange(exp.startDate, exp.endDate, exp.current)}
              </div>
              {exp.description && (
                <div style={{ marginTop: 3 }}>
                  {exp.description.split('\n').map((line, li) => (
                    line.trim() ? (
                      <div key={li} style={{ display: 'flex', gap: 5, marginBottom: 2 }}>
                        <span style={{ color: primaryColor, fontSize: fs, fontWeight: 700, flexShrink: 0, lineHeight: lh }}>–</span>
                        <span style={{ fontSize: fs, fontWeight: 300, color: '#374151', lineHeight: lh }}>{line.trim()}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    if (key === 'education' && education.length > 0) {
      return (
        <div key="education" style={{ marginBottom: 18 }}>
          <div style={mainSecTitleStyle}>Formação Académica</div>
          {education.map((edu, i) => (
            <div key={edu.id} style={{ marginBottom: i < education.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: fs + 2, fontWeight: 700, color: '#111827' }}>
                {edu.degree}{edu.field ? `, ${edu.field}` : ''}
              </div>
              <div style={{ fontSize: fs + 1, fontWeight: 600, color: primaryColor }}>{edu.institution}</div>
              <div style={{ fontSize: fs - 1, fontWeight: 400, color: '#6b7280' }}>
                {fmtDateRange(edu.startDate, edu.endDate, false)}
              </div>
              {edu.description && (
                <div style={{ fontSize: fs, fontWeight: 300, color: '#374151', lineHeight: lh, marginTop: 2 }}>
                  {edu.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    }

    if (key === 'certifications' && certifications.length > 0) {
      return (
        <div key="certifications" style={{ marginBottom: 18 }}>
          <div style={mainSecTitleStyle}>Certificações</div>
          {certifications.map(cert => (
            <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: fs, color: '#111827' }}>{cert.name}</span>
                {cert.issuer && <span style={{ color: '#6b7280', fontSize: fs }}> — {cert.issuer}</span>}
              </div>
              {cert.date && (
                <span style={{ fontSize: fs - 1, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>
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
        <div key={key} style={{ marginBottom: 18 }}>
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
      display: 'flex',
      width: 794,
      minHeight: 1123,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 222,
        background: '#fafaf9',
        padding: '36px 20px',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}>
        {/* Photo */}
        {personal.photo && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <img
              src={personal.photo}
              alt="foto"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `1.5px solid ${primaryColor}`,
              }}
            />
          </div>
        )}

        {/* Name */}
        <div style={{ fontSize: fs + 10, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
          {personal.fullName || 'Nome Completo'}
        </div>

        {/* Job title */}
        {personal.jobTitle && (
          <div style={{
            fontSize: fs - 1,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '2.8px',
            color: primaryColor,
            marginTop: 4,
          }}>
            {personal.jobTitle}
          </div>
        )}

        {/* Accent line */}
        <div style={{ width: 24, height: 1.5, background: primaryColor, margin: '12px 0' }} />

        {/* Contact section */}
        <div style={{ marginBottom: 18 }}>
          <div style={sidebarSecTitleStyle}>Contacto</div>
          {personal.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: fs, color: '#374151', fontWeight: 400, wordBreak: 'break-all' }}>
              {personal.email}
            </div>
          )}
          {personal.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: fs, color: '#374151', fontWeight: 400 }}>
              {personal.phone}
            </div>
          )}
          {personal.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: fs, color: '#374151', fontWeight: 400 }}>
              {personal.address}
            </div>
          )}
          {personal.linkedin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: fs, color: '#374151', fontWeight: 400, wordBreak: 'break-all' }}>
              {personal.linkedin}
            </div>
          )}
          {personal.website && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: fs, color: '#374151', fontWeight: 400, wordBreak: 'break-all' }}>
              {personal.website}
            </div>
          )}
          {personal.showNationality && personal.nationality && (
            <div style={{ fontSize: fs, color: '#374151', marginBottom: 4 }}>{personal.nationality}</div>
          )}
          {personal.showBirthDate && personal.birthDate && (
            <div style={{ fontSize: fs, color: '#374151', marginBottom: 4 }}>{personal.birthDate}</div>
          )}
        </div>

        {/* Skills section */}
        {skills.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={sidebarSecTitleStyle}>Competências</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {skills.map(sk => (
                <span
                  key={sk.id}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    border: '1px solid #ddd9d2',
                    background: '#fafaf9',
                    borderRadius: 20,
                    fontSize: fs - 1,
                    fontWeight: 600,
                    color: '#374151',
                    margin: '0 3px 4px 0',
                  }}
                >
                  {sk.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages section */}
        {languages.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={sidebarSecTitleStyle}>Idiomas</div>
            {languages.map(lang => (
              <div key={lang.id} style={{ fontSize: fs, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
                <strong style={{ color: '#111827' }}>{lang.name}</strong>
                {lang.level ? ` — ${lang.level}` : ''}
              </div>
            ))}
          </div>
        )}

        {/* Habilidades Técnicas */}
        {habilidades.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={sidebarSecTitleStyle}>Habilidades Técnicas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {habilidades.map(h => (
                <div key={h.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: fs, color: '#374151', fontWeight: 500 }}>{h.name}</span>
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

        {/* Cursos */}
        {cursos.length > 0 && (
          <div style={{ marginBottom: 18 }}>
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

        {/* Interesses */}
        {interesses.length > 0 && (
          <div>
            <div style={sidebarSecTitleStyle}>Interesses</div>
            {interesses.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 3 }}>
                <span style={{ color: primaryColor, fontSize: fs, fontWeight: 700, flexShrink: 0 }}>–</span>
                <span style={{ fontSize: fs - 1, color: '#374151', lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main style={{
        flex: 1,
        padding: '36px 24px 36px 28px',
        background: '#fff',
        boxSizing: 'border-box',
      }}>
        {sectionOrder.map(key => renderMainSection(key))}
      </main>
    </div>
  )
}
