import axios from 'axios'

// accessToken lives in memory only — never in localStorage (XSS protection)
let accessToken = null
let silentRefreshTimer = null

export function setAccessToken(token) {
  accessToken = token
  scheduleSilentRefresh(token)
}
export function getAccessToken() { return accessToken }
export function clearAccessToken() {
  accessToken = null
  if (silentRefreshTimer) {
    clearTimeout(silentRefreshTimer)
    silentRefreshTimer = null
  }
}

/**
 * Parse JWT exp claim without a library
 */
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp // Unix timestamp in seconds
  } catch {
    return null
  }
}

/**
 * Schedule a silent token refresh 60 seconds before expiry.
 * This prevents the user's in-flight requests from failing with 401.
 */
function scheduleSilentRefresh(token) {
  if (silentRefreshTimer) {
    clearTimeout(silentRefreshTimer)
    silentRefreshTimer = null
  }

  const exp = getTokenExpiry(token)
  if (!exp) return

  const msUntilRefresh = (exp * 1000) - Date.now() - 60_000 // 60s before expiry
  if (msUntilRefresh <= 0) return // already close to expiry, let interceptor handle it

  silentRefreshTimer = setTimeout(async () => {
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
      setAccessToken(data.access_token) // schedules next refresh automatically
      // Dispatch event so AuthContext can update user state if profile changed
      if (data.user) {
        window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: data.user }))
      }
    } catch {
      clearAccessToken()
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
  }, msUntilRefresh)
}

// Refresh silent tokens when tab becomes visible again
// (setTimeout can be throttled in background tabs)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && accessToken) {
    const exp = getTokenExpiry(accessToken)
    if (exp && exp * 1000 - Date.now() < 120_000) {
      // Token expires in < 2 min — refresh immediately
      scheduleSilentRefresh(accessToken) // will fire instantly (msUntilRefresh <= 0 path skips, but...)
      // Force immediate refresh
      axios.post('/api/auth/refresh', {}, { withCredentials: true })
        .then(({ data }) => {
          setAccessToken(data.access_token)
          if (data.user) window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: data.user }))
        })
        .catch(() => {
          clearAccessToken()
          window.dispatchEvent(new CustomEvent('auth:expired'))
        })
    }
  }
})

const api = axios.create({
  baseURL: '/api',
  withCredentials: true // required for httpOnly refreshToken cookie
})

api.interceptors.request.use(cfg => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
    const isAuthRoute = err.config?.url?.startsWith('/auth/')
    if (err.response?.status === 401 && !err.config._retry && !isAuthRoute) {
      err.config._retry = true
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        setAccessToken(data.access_token)
        if (data.user) window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: data.user }))
        err.config.headers.Authorization = `Bearer ${data.access_token}`
        return api(err.config)
      } catch {
        clearAccessToken()
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
    }
    return Promise.reject(err)
  }
)

export default api
