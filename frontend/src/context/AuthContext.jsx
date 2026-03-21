import { createContext, useContext, useState, useEffect } from 'react'
import api, { setAccessToken, clearAccessToken } from '../api/client'
import axios from 'axios'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // При загрузке пробуем восстановить сессию через refreshToken cookie
  useEffect(() => {
    axios.post('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.access_token)
        return api.get('/auth/me')
      })
      .then(r => setUser(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    setAccessToken(data.access_token)
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
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
