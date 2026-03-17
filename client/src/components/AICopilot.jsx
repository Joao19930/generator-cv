import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Check, X } from 'lucide-react'

const NAVY = '#1B3D6F'
const GOLD = '#C9A84C'
const ORANGE = '#EF9F27'

const QUICK_ACTIONS = [
  { label: 'Melhorar sumário', prompt: 'Analisa o meu sumário actual e reescreve-o com linguagem de alto impacto para CVs de topo. Quantifica os achievements e adiciona keywords ATS. Inclui sugestão no formato <suggestion>.' },
  { label: 'Quantificar achievements', prompt: 'Revê os meus bullets de experiência e sugere versões melhoradas com dados quantificados (números, percentagens, valores €). Para cada um inclui uma sugestão no formato <suggestion>.' },
  { label: 'ATS score', prompt: 'Analisa o meu CV e dá-me um score ATS estimado de 0-100 com justificação detalhada e sugestões de melhoria.' },
  { label: '→ Goldman Sachs', prompt: 'Adapta o meu CV para uma candidatura ao Goldman Sachs. Identifica o que está em falta, sugere linguagem específica do sector e keywords relevantes. Inclui sugestões no formato <suggestion>.' },
  { label: '→ McKinsey', prompt: 'Adapta o meu CV para candidatura ao McKinsey & Company. Foca no framework de Problem Solving e impacto mensurável. Inclui sugestões.' },
  { label: '→ Big Four', prompt: 'Adapta o meu CV para candidatura às Big Four (Deloitte, PwC, EY, KPMG). Destaca as competências mais relevantes. Inclui sugestões no formato <suggestion>.' },
]

export default function AICopilot({ useClaude: { messages, isStreaming, sendMessage, acceptSuggestion, rejectSuggestion } }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isStreaming])

  const send = () => {
    if (!input.trim() || isStreaming) return
    sendMessage(input.trim())
    setInput('')
  }

  const S = {
    panel: { width: 260, background: '#fff', borderLeft: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
    header: { padding: '14px 16px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', flexShrink: 0 },
    hdrTop: { display: 'flex', alignItems: 'center', gap: 8 },
    icon: { width: 28, height: 28, background: `${GOLD}22`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 14, fontWeight: 700, color: '#1a1a1a' },
    sub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
    msgs: { flex: 1, overflowY: 'auto', padding: '12px 12px 0' },
    msgUser: { display: 'flex', justifyContent: 'flex-end', marginBottom: 10 },
    msgBubbleUser: { background: NAVY, color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', fontSize: 12, maxWidth: '85%', lineHeight: 1.4 },
    msgBubbleAI: { background: '#f1f5f9', color: '#334155', borderRadius: '12px 12px 12px 2px', padding: '8px 12px', fontSize: 12, maxWidth: '88%', lineHeight: 1.5 },
    suggCard: { border: `1.5px solid ${ORANGE}`, borderRadius: 10, padding: '10px 12px', marginTop: 8, background: `${ORANGE}08`, animation: 'slide-in .2s ease' },
    suggLabel: { fontSize: 10, fontWeight: 700, color: ORANGE, marginBottom: 4 },
    suggText: { fontSize: 11.5, color: '#334155', lineHeight: 1.4, marginBottom: 8 },
    suggBtns: { display: 'flex', gap: 6 },
    acceptBtn: { flex: 1, background: NAVY, color: '#fff', border: 'none', borderRadius: 6, padding: '5px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 },
    rejectBtn: { flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, padding: '5px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 },
    dots: { display: 'flex', gap: 4, padding: '10px 12px' },
    dot: (i) => ({ width: 6, height: 6, background: NAVY, borderRadius: '50%', animation: `pulse-dot 1s ${i * 0.2}s infinite` }),
    quickWrap: { padding: '8px 12px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', flexWrap: 'wrap', gap: 4 },
    quickBtn: { fontSize: 10, fontWeight: 600, border: `0.5px solid rgba(0,0,0,0.12)`, borderRadius: 20, padding: '3px 8px', cursor: 'pointer', background: '#fff', color: '#475569', whiteSpace: 'nowrap' },
    inputRow: { display: 'flex', gap: 6, padding: '10px 12px', borderTop: '0.5px solid rgba(0,0,0,0.06)', flexShrink: 0 },
    input: { flex: 1, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '7px 10px', fontSize: 12, outline: 'none', fontFamily: 'DM Sans, sans-serif', resize: 'none' },
    sendBtn: { background: isStreaming ? '#e2e8f0' : NAVY, border: 'none', borderRadius: 8, padding: '7px 10px', cursor: isStreaming ? 'default' : 'pointer', color: '#fff', display: 'flex', alignItems: 'center' },
  }

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <div style={S.hdrTop}>
          <div style={S.icon}><Sparkles size={14} color={GOLD} /></div>
          <div>
            <div style={S.title}>Copiloto IA</div>
            <div style={S.sub}>claude-haiku · Wall St & Big Four</div>
          </div>
        </div>
      </div>

      <div style={S.msgs}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
            Olá! Sou o teu assistente de CV. Usa os atalhos abaixo ou faz uma pergunta.
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div style={S.msgUser}>
                <div style={S.msgBubbleUser}>{msg.content}</div>
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <div style={S.msgBubbleAI}>{msg.content || (isStreaming ? '' : 'A pensar...')}</div>
                {(msg.suggestions || []).map((sug, i) => (
                  <div key={i} style={S.suggCard}>
                    <div style={S.suggLabel}>✦ Sugestão de alteração</div>
                    <div style={S.suggText}>{typeof sug.value === 'string' ? sug.value.slice(0, 150) + (sug.value.length > 150 ? '...' : '') : JSON.stringify(sug.value)}</div>
                    <div style={S.suggBtns}>
                      <button style={S.acceptBtn} onClick={() => acceptSuggestion(sug, msg.id)}>
                        <Check size={11} /> Aceitar
                      </button>
                      <button style={S.rejectBtn} onClick={() => rejectSuggestion(sug, msg.id)}>
                        <X size={11} /> Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {isStreaming && (
          <div style={S.dots}>
            {[0, 1, 2].map(i => <div key={i} style={S.dot(i)} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={S.quickWrap}>
        {QUICK_ACTIONS.map((qa, i) => (
          <button key={i} style={S.quickBtn} onClick={() => { sendMessage(qa.prompt) }}>
            {qa.label}
          </button>
        ))}
      </div>

      <div style={S.inputRow}>
        <textarea
          style={S.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Pergunta algo..."
          rows={1}
        />
        <button style={S.sendBtn} onClick={send} disabled={isStreaming}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
