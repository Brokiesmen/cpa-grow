import { createContext, useContext, useState, useEffect } from 'react'
import api, { setAccessToken, clearAccessToken } from '../api/client'
import axios from 'axios'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    restoreSession().finally(() => setLoading(false))
  }, [])

  // Listen for token expiry / silent refresh events from the axios client
  useEffect(() => {
    const onExpired  = ()  => setUser(null)
    const onRefreshed = e  => { if (e.detail) setUser(e.detail) }
    window.addEventListener('auth:expired',   onExpired)
    window.addEventListener('auth:refreshed', onRefreshed)
    return () => {
      window.removeEventListener('auth:expired',   onExpired)
      window.removeEventListener('auth:refreshed', onRefreshed)
    }
  }, [])

  /**
   * Session restoration on app start.
   *
   * Step 1 — refresh token cookie (fast, works for all returning users).
   * Step 2 — Telegram initData silent auth (fallback when cookie is missing/expired).
   *           Always available in Mini App, so Telegram users never have to re-login
   *           after cookie expiry. New users (is_new_user=true) are left unauthenticated
   *           so the login page is shown for registration.
   */
  async function restoreSession() {
    // Step 1: try httpOnly refresh token cookie
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
      setAccessToken(data.access_token)
      setUser(data.user ?? null)
      return
    } catch {}

    // Step 2: Telegram Mini App — silent auth via initData
    const tg = window.Telegram?.WebApp
    if (tg?.initData) {
      try {
        const { data } = await axios.post(
          '/api/auth/telegram-webapp',
          { initData: tg.initData },
          { withCredentials: true }
        )
        if (!data.is_new_user) {
          setAccessToken(data.access_token)
          setUser(data.user ?? null)
        }
        // is_new_user=true → user=null → login page shown for first-time registration
      } catch {}
    }
  }

  /**
   * Email/password login — user profile comes directly from the response.
   */
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setAccessToken(data.access_token)
    setUser(data.user)
    return data.user
  }

  /**
   * OAuth login (Google, Telegram widget, Web3).
   * Pass userFromResponse to skip the extra /auth/me call.
   */
  const loginWithToken = async (token, userFromResponse = null) => {
    setAccessToken(token)
    if (userFromResponse) {
      setUser(userFromResponse)
      return userFromResponse
    }
    // Fallback for providers that don't return user in response
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
