import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import api, { setAccessToken, clearAccessToken } from '../api/client'
import { csGet, csSet, csRemove } from '../lib/cloudStorage'

const AuthCtx = createContext(null)
const CS_KEY = 'rt' // CloudStorage key for refresh token

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
   * Session restoration on app start — three layers:
   *
   * 1. Telegram CloudStorage — persists across ALL Mini App opens on all platforms.
   *    Works for all user types (email, Telegram, OAuth) because we store
   *    the refresh token here after every successful login.
   *
   * 2. httpOnly cookie — works in regular browsers and some WebViews.
   *    Falls back here if CloudStorage is empty (first login on new device, etc.)
   *
   * 3. Telegram initData — last resort for Telegram-registered users.
   *    Always fresh on Mini App open; re-authenticates without any stored tokens.
   */
  async function restoreSession() {
    // Step 1: CloudStorage (best for Telegram Mini App)
    const storedToken = await csGet(CS_KEY)
    if (storedToken) {
      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          { refreshToken: storedToken },
          { withCredentials: true }
        )
        setAccessToken(data.access_token)
        setUser(data.user ?? null)
        await csSet(CS_KEY, data.refresh_token) // rotate stored token
        return
      } catch {
        await csRemove(CS_KEY) // token invalid — clear it
      }
    }

    // Step 2: httpOnly cookie
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
      setAccessToken(data.access_token)
      setUser(data.user ?? null)
      if (data.refresh_token) await csSet(CS_KEY, data.refresh_token) // save for next time
      return
    } catch {}

    // Step 3: Telegram initData (for Telegram-registered users, no stored tokens)
    const tg = window.Telegram?.WebApp
    if (tg?.initData) {
      try {
        const { data } = await axios.post(
          '/api/auth/telegram-webapp',
          { initData: tg.initData },
          { withCredentials: true }
        )
        if (!data.is_new_user && data.access_token) {
          setAccessToken(data.access_token)
          setUser(data.user ?? null)
          if (data.refresh_token) await csSet(CS_KEY, data.refresh_token)
        }
      } catch {}
    }
  }

  /** Save refresh token to CloudStorage after every login */
  async function persistToken(data) {
    if (data.refresh_token) {
      await csSet(CS_KEY, data.refresh_token)
    }
  }

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setAccessToken(data.access_token)
    setUser(data.user)
    await persistToken(data)
    return data.user
  }

  const loginWithToken = async (token, userFromResponse = null, rawData = null) => {
    setAccessToken(token)
    if (rawData) await persistToken(rawData)
    if (userFromResponse) {
      setUser(userFromResponse)
      return userFromResponse
    }
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  const logout = async () => {
    const storedToken = await csGet(CS_KEY)
    try {
      await api.post('/auth/logout', storedToken ? { refreshToken: storedToken } : {})
    } catch {}
    clearAccessToken()
    await csRemove(CS_KEY)
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, loginWithToken, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
