import { useState, useEffect } from 'react'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('cv_token')

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUser(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  return {
    user,
    loading,
    token,
    isPremium: user?.plan === 'premium',
    isLoggedIn: !!user,
  }
}
