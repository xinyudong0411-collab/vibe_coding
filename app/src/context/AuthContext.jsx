import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)
const TOKEN_KEY   = 'fund_auth_token'

export function AuthProvider({ children }) {
  const [token,   setToken]   = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Verify stored token on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => r.json())
      .then(data => {
        if (data.ok) { setUser(data.user); setToken(stored) }
        else         { localStorage.removeItem(TOKEN_KEY); setToken(null) }
      })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null) })
      .finally(()  => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (email, password) => {
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
