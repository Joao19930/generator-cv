import React from 'react'
import { Briefcase, Bookmark, ExternalLink, Loader2, Zap } from 'lucide-react'

const NAVY = '#1B3D6F'
const GOLD = '#C9A84C'
const GREEN = '#1D9E75'

export default function JobRecommendations({ isPremium, hookData }) {
  const { jobs, loading, activeSources, activeFilter, savedJobs, toggleSource, toggleSave, setActiveFilter, SOURCE_COLORS, SOURCES, FILTERS } = hookData

  const S = {
    panel: { width: 280, background: '#fff', borderLeft: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' },
    gate: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' },
    gateIcon: { width: 48, height: 48, background: `${GOLD}22`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    gateTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a1a' },
    gateDesc: { fontSize: 12, color: '#94a3b8', lineHeight: 1.5 },
    upgradeBtn: { background: GOLD, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
    header: { padding: '14px 14px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', flexShrink: 0 },
    hdrRow: { display: 'flex', alignItems: 'center', gap: 6 },
    hdrTitle: { fontSize: 13, fontWeight: 700, color: '#1a1a1a' },
    badge: { fontSize: 9, fontWeight: 700, background: `${GOLD}22`, color: GOLD, borderRadius: 20, padding: '2px 7px' },
    dot: { width: 6, height: 6, borderRadius: '50%', background: GREEN, animation: loading ? 'pulse-dot 1s infinite' : 'none', marginLeft: 4 },
    sourceBar: { display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' },
    srcBtn: (active, color) => ({ fontSize: 9, fontWeight: 700, border: 'none', borderRadius: 20, padding: '3px 8px', cursor: 'pointer', background: active ? color : '#f1f5f9', color: active ? '#fff' : '#94a3b8', transition: 'all .15s' }),
    filterBar: { display: 'flex', gap: 4, overflowX: 'auto', padding: '8px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' },
    filterBtn: (active) => ({ fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', background: active ? NAVY : '#f1f5f9', color: active ? '#fff' : '#64748b', whiteSpace: 'nowrap', transition: 'all .15s', flexShrink: 0 }),
    list: { flex: 1, overflowY: 'auto', padding: '8px 10px' },
    card: (isFirst) => ({ border: `0.5px solid ${isFirst ? GREEN : 'rgba(0,0,0,0.08)'}`, borderRadius: 10, padding: '12px', marginBottom: 8, animation: 'slide-in .2s ease', position: 'relative', background: isFirst ? `${GREEN}05` : '#fff' }),
    bestBadge: { position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 700, color: GREEN, background: `${GREEN}18`, borderRadius: 20, padding: '2px 7px' },
    logo: (color) => ({ width: 32, height: 32, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }),
    role: { fontSize: 12, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 },
    company: { fontSize: 11, color: '#64748b' },
    meta: { display: 'flex', gap: 6, fontSize: 10, color: '#94a3b8', marginTop: 4, flexWrap: 'wrap' },
    matchBadge: (score) => ({ fontSize: 9, fontWeight: 700, borderRadius: 20, padding: '2px 7px', background: score >= 85 ? `${GREEN}22` : score >= 70 ? `${NAVY}18` : '#f1f5f9', color: score >= 85 ? GREEN : score >= 70 ? NAVY : '#94a3b8' }),
    skillsRow: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 },
    skillMatch: { fontSize: 9, fontWeight: 600, background: `${GREEN}18`, color: GREEN, borderRadius: 4, padding: '1px 6px' },
    skillMiss: { fontSize: 9, fontWeight: 600, border: '0.5px dashed #cbd5e1', color: '#94a3b8', borderRadius: 4, padding: '1px 6px' },
    actions: { display: 'flex', gap: 6, marginTop: 8 },
    saveBtn: (saved) => ({ flex: 1, fontSize: 10, fontWeight: 600, border: `0.5px solid ${saved ? GOLD : 'rgba(0,0,0,0.12)'}`, borderRadius: 6, padding: '5px', cursor: 'pointer', background: saved ? `${GOLD}18` : '#fff', color: saved ? GOLD : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }),
    applyBtn: { flex: 2, fontSize: 10, fontWeight: 600, border: 'none', borderRadius: 6, padding: '5px', cursor: 'pointer', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 },
  }

  if (!isPremium) {
    return (
      <div style={S.panel}>
        <div style={S.gate}>
          <div style={S.gateIcon}><Briefcase size={22} color={GOLD} /></div>
          <div style={S.gateTitle}>Vagas Personalizadas</div>
          <div style={S.gateDesc}>Activa o Premium para ver vagas recomendadas baseadas no teu perfil, com score de correspondência e filtros avançados.</div>
          <button style={S.upgradeBtn} onClick={() => window.open('https://wa.me/244944524292?text=Olá!%20Quero%20activar%20o%20Plano%20Premium', '_blank')}>
            Upgrade para Premium
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <div style={S.hdrRow}>
          <div style={S.hdrTitle}>Vagas recomendadas</div>
          <div style={S.badge}>★ Premium</div>
          <div style={S.dot} />
        </div>
      </div>

      <div style={S.sourceBar}>
        {SOURCES.map(src => (
          <button key={src} style={S.srcBtn(activeSources.has(src), SOURCE_COLORS[src])} onClick={() => toggleSource(src)}>{src}</button>
        ))}
      </div>

      <div style={S.filterBar}>
        {FILTERS.map(f => (
          <button key={f} style={S.filterBtn(activeFilter === f)} onClick={() => setActiveFilter(f)}>{f}</button>
        ))}
      </div>

      <div style={S.list}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: '#94a3b8', fontSize: 12 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> A procurar vagas...
          </div>
        )}
        {!loading && jobs.length === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 24 }}>
            Preenche o título profissional para ver vagas recomendadas.
          </div>
        )}
        {jobs.map((job, idx) => {
          const isFirst = idx === 0
          const matched = job.requiredSkills.slice(0, 3)
          const missing = job.requiredSkills.slice(3, 5)
          return (
            <div key={job.id} style={S.card(isFirst)}>
              {isFirst && <div style={S.bestBadge}>⚡ Melhor correspondência</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={S.logo(job.logoColor)}>{job.logo}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.role}>{job.role}</div>
                  <div style={S.company}>{job.company}</div>
                  <div style={S.meta}>
                    <span>{job.location}</span>
                    <span>·</span>
                    <span>{job.daysAgo}d atrás</span>
                    <span>·</span>
                    <span>{job.salary}</span>
                  </div>
                </div>
                {job.matchScore > 0 && <div style={S.matchBadge(job.matchScore)}>{job.matchScore}%</div>}
              </div>
              <div style={S.skillsRow}>
                {matched.map(s => <span key={s} style={S.skillMatch}>{s}</span>)}
                {missing.map(s => <span key={s} style={S.skillMiss}>{s}</span>)}
              </div>
              <div style={S.actions}>
                <button style={S.saveBtn(savedJobs.has(job.id))} onClick={() => toggleSave(job.id)}>
                  <Bookmark size={10} /> {savedJobs.has(job.id) ? 'Guardado' : 'Guardar'}
                </button>
                <button style={S.applyBtn} onClick={() => window.open('#', '_blank')}>
                  <ExternalLink size={10} /> Candidatar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
