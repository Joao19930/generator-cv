import { useState, useCallback } from 'react'
import { useResumeStore } from './useResumeStore'

const SYSTEM_PROMPT = `És um especialista em CVs para Wall Street (Goldman Sachs, Morgan Stanley, JPMorgan, Blackstone) e Big Four/MBB (McKinsey, BCG, Bain, Deloitte, PwC, EY, KPMG).
O teu objectivo é ajudar o utilizador a criar um CV de topo com linguagem de alto impacto, bullets quantificados (números, percentagens, €/$), keywords ATS-optimizadas, e formatação impecável.
Quando sugerires uma alteração ao CV, inclui-a no formato: <suggestion>{"action":"updateField","field":"personalInfo.summary","value":"..."}</suggestion>
Responde sempre em português de Portugal.`

const parseSuggestions = (text) => {
  const regex = /<suggestion>([\s\S]*?)<\/suggestion>/g
  const suggestions = []
  let match
  while ((match = regex.exec(text)) !== null) {
    try { suggestions.push(JSON.parse(match[1])) } catch {}
  }
  return suggestions
}

const cleanText = (text) => text.replace(/<suggestion>[\s\S]*?<\/suggestion>/g, '').trim()

export function useClaude(token) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const getResumeJSON = useResumeStore(s => s.getResumeJSON)
  const applyAISuggestion = useResumeStore(s => s.applyAISuggestion)

  const sendMessage = useCallback(async (userMessage) => {
    const resumeJSON = getResumeJSON()
    const contextualMessage = `${userMessage}\n\n[CV actual: ${JSON.stringify(resumeJSON, null, 2)}]`

    const newMessages = [...messages, { role: 'user', content: userMessage, id: Date.now() }]
    setMessages(newMessages)
    setIsStreaming(true)
    setError(null)

    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId, suggestions: [], rejectedSuggestions: [] }])

    try {
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: contextualMessage }
          ]
        })
      })

      if (!response.ok) { throw new Error('Erro na API de IA') }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.delta?.text || parsed.choices?.[0]?.delta?.content || ''
              if (delta) {
                full += delta
                setMessages(prev => prev.map(m => m.id === assistantId
                  ? { ...m, content: cleanText(full), suggestions: parseSuggestions(full) }
                  : m))
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setError(err.message)
      setMessages(prev => prev.map(m => m.id === assistantId
        ? { ...m, content: 'Erro ao contactar o assistente. Tenta novamente.' }
        : m))
    } finally {
      setIsStreaming(false)
    }
  }, [messages, getResumeJSON, token])

  const acceptSuggestion = useCallback((suggestion, messageId) => {
    if (suggestion.action === 'updateField') {
      applyAISuggestion(suggestion.field, suggestion.value)
    }
    setMessages(prev => prev.map(m => m.id === messageId
      ? { ...m, suggestions: m.suggestions.filter(s => s !== suggestion), rejectedSuggestions: [...(m.rejectedSuggestions || []), suggestion] }
      : m))
  }, [applyAISuggestion])

  const rejectSuggestion = useCallback((suggestion, messageId) => {
    setMessages(prev => prev.map(m => m.id === messageId
      ? { ...m, suggestions: m.suggestions.filter(s => s !== suggestion), rejectedSuggestions: [...(m.rejectedSuggestions || []), suggestion] }
      : m))
  }, [])

  return { messages, isStreaming, error, sendMessage, acceptSuggestion, rejectSuggestion }
}
