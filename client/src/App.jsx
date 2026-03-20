import React from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import CVEditor from './components/CVEditor'

export default function App() {
  const { token, isPremium, isLoggedIn, loading } = useAuth()
  const params = new URLSearchParams(window.location.search)
  const cvId = params.get('cv')

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f172a',
        color: '#94a3b8',
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
      }}>
        A carregar...
      </div>
    )
  }

  if (!isLoggedIn) {
    window.location.href = '/login'
    return null
  }

  return (
    <>
      <CVEditor cvId={cvId} token={token} isPremium={isPremium} />
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            fontSize: 13,
            fontFamily: 'Inter, sans-serif',
            border: '1px solid #334155',
          },
        }}
      />
    </>
  )
}
