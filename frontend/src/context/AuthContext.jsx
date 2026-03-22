import { createContext, useContext, useState, useEffect } from 'react'
import api, { setAccessToken, clearAccessToken } from '../api/client'
import axios from 'axios'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount via httpOnly refreshToken cookie
  useEffect(() => {
    axios.post('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.access_token)
        setUser(data.user ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Listen for token expiry / silent refresh events from the axios client
  useEffect(() => {
    const onExpired = () => setUser(null)
    const onRefreshed = e => { if (e.detail) setUser(e.detail) }
    window.addEventListener('auth:expired', onExpired)
    window.addEventListener('auth:refreshed', onRefreshed)
    return () => {
      window.removeEventListener('auth:expired', onExpired)
      window.removeEventListener('auth:refreshed', onRefreshed)
    }
  }, [])

  /**
   * Email/password login — returns user profile from the response directly.
   * No extra /auth/me call needed.
   */
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data.user
  }

  /**
   * OAuth login (Google, Telegram, Web3) — same pattern, user is in the response.
   * Falls back to /auth/me if user is not in the response (legacy compatibility).
   */
  const loginWithToken = async (token, userFromResponse = null) => {
    setAccessToken(token)
    if (userFromResponse) {
      setUser(userFromResponse)
      return userFromResponse
    }
    // Fallback: fetch profile
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } catch {}
    clearAccessToken()
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, loginWithToken, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
