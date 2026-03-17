import React from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { useClaude } from './hooks/useClaude'
import { useJobRecommendations } from './hooks/useJobRecommendations'
import { useResumeStore } from './hooks/useResumeStore'
import Editor from './components/Editor'
import Preview from './components/Preview'
import AICopilot from './components/AICopilot'
import JobRecommendations from './components/JobRecommendations'

export default function App() {
  const { user, loading, token, isPremium, isLoggedIn } = useAuth()
  const claudeHook = useClaude(token)
  const jobsHook = useJobRecommendations(isPremium)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'DM Sans, sans-serif', color: '#94a3b8' }}>
        A carregar...
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1B3D6F' }}>cv<span style={{ color: '#C9A84C' }}>elite</span></div>
        <div style={{ color: '#64748b', fontSize: 14 }}>Necessitas de iniciar sessão</div>
        <button onClick={() => window.location.href = '/login'} style={{ background: '#1B3D6F', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14 }}>
          Iniciar sessão
        </button>
      </div>
    )
  }

  const onAIRequest = (prompt) => claudeHook.sendMessage(prompt)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F7F6F3' }}>
      <Editor onAIRequest={onAIRequest} />
      <Preview />
      <AICopilot useClaude={claudeHook} />
      <JobRecommendations isPremium={isPremium} hookData={jobsHook} />
      <Toaster position="bottom-center" toastOptions={{ style: { fontFamily: 'DM Sans, sans-serif', fontSize: 13 } }} />
    </div>
  )
}
