import axios from 'axios'

// accessToken живёт только в памяти — не в localStorage
let accessToken = null

export function setAccessToken(token) { accessToken = token }
export function getAccessToken() { return accessToken }
export function clearAccessToken() { accessToken = null }

const api = axios.create({
  baseURL: '/api',
  withCredentials: true  // нужно для httpOnly cookie с refreshToken
})

api.interceptors.request.use(cfg => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        setAccessToken(data.access_token)
        err.config.headers.Authorization = `Bearer ${data.access_token}`
        return api(err.config)
      } catch {
        clearAccessToken()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
