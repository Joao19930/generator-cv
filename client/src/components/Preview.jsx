import React from 'react'
import { Download } from 'lucide-react'
import { useResumeStore } from '../hooks/useResumeStore'

const NAVY = '#1B3D6F'
const GOLD = '#C9A84C'

function getAccent(template) { return template === 'wallstreet' ? GOLD : NAVY }

const S = {
  wrap: { flex: 1, background: '#E8E4DE', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 },
  toggleGroup: { display: 'flex', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, overflow: 'hidden' },
  toggleBtn: (active, color) => ({ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: active ? color : '#fff', color: active ? '#fff' : '#64748b', transition: 'all .15s' }),
  dlBtn: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: NAVY, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  scroll: { flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex', justifyContent: 'center' },
  paper: { width: 650, minHeight: 900, background: '#fff', padding: '48px 52px', fontFamily: "'Playfair Display', serif", boxShadow: '0 4px 40px rgba(0,0,0,0.12)', animation: 'slide-in .3s ease' },
  name: (accent) => ({ fontSize: 28, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }),
  title: { fontSize: 13, color: '#475569', fontFamily: "'DM Sans', sans-serif", marginTop: 2, fontWeight: 500 },
  divider: (accent) => ({ height: 2, background: accent, margin: '14px 0', borderRadius: 1 }),
  contact: { display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#64748b', fontFamily: "'DM Sans', sans-serif", marginBottom: 2 },
  sectionTitle: (accent) => ({ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'DM Sans', sans-serif", marginBottom: 8, marginTop: 20 }),
  expHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  expRole: { fontSize: 13, fontWeight: 700, color: '#1a1a1a', fontFamily: "'DM Sans', sans-serif" },
  expDates: { fontSize: 11, color: '#94a3b8', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 },
  expCompany: { fontSize: 12, color: '#475569', fontFamily: "'DM Sans', sans-serif", marginBottom: 4 },
  bullet: (accent) => ({ display: 'flex', gap: 8, marginTop: 3, fontSize: 11.5, color: '#334155', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }),
  bulletDot: (accent) => ({ color: accent, flexShrink: 0, marginTop: 1 }),
  summary: { fontSize: 12, color: '#475569', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.65, marginTop: 4 },
  skillRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  skillTag: (accent) => ({ fontSize: 10.5, color: accent, fontFamily: "'DM Sans', sans-serif", background: `${accent}14`, borderRadius: 4, padding: '2px 8px', fontWeight: 600 }),
}

export default function Preview() {
  const { personalInfo, experience, education, skills, template, setTemplate } = useResumeStore()
  const accent = getAccent(template)

  const handleExport = () => {
    window.print()
  }

  return (
    <div style={S.wrap}>
      <div style={S.topBar}>
        <div style={S.toggleGroup}>
          <button style={S.toggleBtn(template === 'bigfour', NAVY)} onClick={() => setTemplate('bigfour')}>Big Four</button>
          <button style={S.toggleBtn(template === 'wallstreet', GOLD)} onClick={() => setTemplate('wallstreet')}>Wall Street</button>
        </div>
        <button style={S.dlBtn} onClick={handleExport}><Download size={13} /> Exportar PDF</button>
      </div>

      <div style={S.scroll}>
        <div style={S.paper} id="cv-paper">
          {/* Header */}
          <div style={S.name(accent)}>{personalInfo.name || 'O Teu Nome'}</div>
          <div style={S.title}>{personalInfo.title || 'Título Profissional'}</div>
          <div style={S.divider(accent)} />
          <div style={S.contact}>
            {personalInfo.email && <span>✉ {personalInfo.email}</span>}
            {personalInfo.phone && <span>✆ {personalInfo.phone}</span>}
            {personalInfo.location && <span>⊙ {personalInfo.location}</span>}
            {personalInfo.linkedin && <span>in {personalInfo.linkedin}</span>}
          </div>

          {/* Sumário */}
          {personalInfo.summary && (
            <>
              <div style={S.sectionTitle(accent)}>Sumário</div>
              <div style={S.summary}>{personalInfo.summary}</div>
            </>
          )}

          {/* Experiência */}
          {experience.length > 0 && (
            <>
              <div style={S.sectionTitle(accent)}>Experiência Profissional</div>
              {experience.map(exp => (
                <div key={exp.id} style={{ marginBottom: 14 }}>
                  <div style={S.expHeader}>
                    <div style={S.expRole}>{exp.role || 'Cargo'}</div>
                    <div style={S.expDates}>{exp.startDate}{exp.startDate && (exp.endDate || exp.current) ? ' – ' : ''}{exp.current ? 'Presente' : exp.endDate}</div>
                  </div>
                  <div style={S.expCompany}>{exp.company || 'Empresa'}</div>
                  {exp.bullets.filter(b => b.trim()).map((b, i) => (
                    <div key={i} style={S.bullet(accent)}>
                      <span style={S.bulletDot(accent)}>•</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* Educação */}
          {education.length > 0 && (
            <>
              <div style={S.sectionTitle(accent)}>Educação</div>
              {education.map(edu => (
                <div key={edu.id} style={{ marginBottom: 10 }}>
                  <div style={S.expHeader}>
                    <div style={S.expRole}>{edu.degree}{edu.field ? ` em ${edu.field}` : ''}</div>
                    <div style={S.expDates}>{edu.year}</div>
                  </div>
                  <div style={S.expCompany}>{edu.institution}{edu.gpa ? ` · ${edu.gpa}` : ''}</div>
                </div>
              ))}
            </>
          )}

          {/* Competências */}
          {skills.length > 0 && (
            <>
              <div style={S.sectionTitle(accent)}>Competências</div>
              {skills.map(sk => (
                <div key={sk.id} style={{ marginBottom: 8 }}>
                  {sk.category && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{sk.category}</div>}
                  <div style={S.skillRow}>
                    {(sk.items || []).map((item, i) => (
                      <span key={i} style={S.skillTag(accent)}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
