import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTelegram } from '../context/TelegramContext'
import { getInitData } from '../lib/telegram'
import api from '../api/client'
import GoogleButton from '../components/GoogleButton'
import WalletButton from '../components/WalletButton'
import './Auth.css'

// Онбординг для новых пользователей Telegram
function TelegramOnboarding({ tgUser, initData, onSuccess, onError }) {
  const [role, setRole] = useState('PUBLISHER')
  const [username, setUsername] = useState(tgUser.username || '')
  const [loading, setLoading] = useState(false)
  const { loginWithToken } = useAuth()

  const handleSubmit = async e => {
    e.preventDefault()
    if (role === 'PUBLISHER' && username.trim().length < 3) {
      onError('Username must be at least 3 characters')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/telegram-webapp', {
        initData,
        role,
        username: role === 'PUBLISHER' ? username.trim() : undefined,
      })
      const user = await loginWithToken(data.access_token, data.user, data)
      onSuccess(user.role)
    } catch (err) {
      const code = err.response?.data?.error
      if (code === 'USERNAME_TAKEN') onError('Username is already taken, choose another')
      else onError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-header">
        {tgUser.photo_url
          ? <img src={tgUser.photo_url} alt="" className="auth-tg-photo" style={{ marginBottom: 14 }} />
          : <div className="auth-tg-initials" style={{ marginBottom: 14 }}>{tgUser.first_name?.[0] || '?'}</div>
        }
        <div className="auth-title">Hi, {tgUser.first_name}!</div>
        <div className="auth-subtitle">Choose your account type to get started</div>
      </div>

      <form onSubmit={handleSubmit} className="auth-body">
        <div className="auth-role-grid">
          <button type="button" className={`auth-role-btn${role === 'PUBLISHER' ? ' active' : ''}`} onClick={() => setRole('PUBLISHER')}>
            <span className="role-icon">📢</span>
            <span className="role-name">Publisher</span>
            <span className="role-desc">Drive traffic, earn payouts</span>
          </button>
          <button type="button" className={`auth-role-btn${role === 'ADVERTISER' ? ' active' : ''}`} onClick={() => setRole('ADVERTISER')}>
            <span className="role-icon">🎯</span>
            <span className="role-name">Advertiser</span>
            <span className="role-desc">Launch offers & campaigns</span>
          </button>
        </div>

        {role === 'PUBLISHER' && (
          <div className="auth-section">
            <div className="auth-row">
              <div className="auth-row-icon blue">@</div>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                minLength={3}
                required
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <button className="auth-btn-primary" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : `Join as ${role === 'PUBLISHER' ? 'Publisher' : 'Advertiser'}`}
        </button>

        <p className="auth-footer-link">
          Already have an account?{' '}
          <button type="button" onClick={() => onError('')}>Sign in</button>
        </p>
      </form>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tgNewUser, setTgNewUser] = useState(null)

  const { login, loginWithToken } = useAuth()
  const { isTelegramApp } = useTelegram()
  const navigate = useNavigate()

  const redirect = role => {
    if (role === 'PUBLISHER') navigate('/publisher')
    else if (role === 'ADVERTISER') navigate('/advertiser')
    else navigate('/admin')
  }

  if (tgNewUser) {
    return (
      <TelegramOnboarding
        tgUser={tgNewUser}
        initData={getInitData()}
        onSuccess={redirect}
        onError={msg => { setTgNewUser(null); if (msg) setError(msg) }}
      />
    )
  }

  const handleEmail = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login(email, password)
      redirect(user.role)
    } catch (err) {
      const code = err.response?.data?.error
      if (code === 'ACCOUNT_PENDING_APPROVAL') setError('Your account is pending admin approval')
      else if (code === 'ACCOUNT_BANNED') setError('Account is banned')
      else setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async token => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/google', { idToken: token })
      const user = await loginWithToken(data.access_token, data.user, data)
      redirect(user.role)
    } catch (err) {
      const code = err.response?.data?.error
      if (code === 'GOOGLE_AUTH_NOT_CONFIGURED') setError('Google login not configured yet')
      else setError(err.response?.data?.message || 'Google login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleTelegram = async () => {
    setError('')

    if (isTelegramApp) {
      const initData = getInitData()
      if (!initData) { setError('Telegram data not available'); return }
      setLoading(true)
      try {
        const { data } = await api.post('/auth/telegram-webapp', { initData })
        if (data.is_new_user) {
          setTgNewUser(data.tg_user)
        } else {
          const user = await loginWithToken(data.access_token, data.user, data)
          redirect(user.role)
        }
      } catch (err) {
        const code = err.response?.data?.error
        if (code === 'TELEGRAM_AUTH_NOT_CONFIGURED') setError('Telegram bot not configured on server')
        else setError(err.response?.data?.message || 'Telegram login failed')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!import.meta.env.VITE_TELEGRAM_BOT_NAME) {
      setError('Telegram login is not configured yet')
      return
    }
    window.TelegramLoginCallback = async data => {
      setLoading(true)
      setError('')
      try {
        const res = await api.post('/auth/telegram', data)
        const user = await loginWithToken(res.data.access_token, res.data.user, res.data)
        redirect(user.role)
      } catch (err) {
        setError(err.response?.data?.message || 'Telegram login failed')
      } finally {
        setLoading(false)
      }
    }
    const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME
    window.open(
      `https://oauth.telegram.org/auth?bot_id=${botName}&origin=${encodeURIComponent(window.location.origin)}&return_to=${encodeURIComponent(window.location.href)}`,
      'telegram_oauth', 'width=550,height=470'
    )
  }

  return (
    <div className="auth-wrap">
      {/* Header */}
      <div className="auth-header">
        <div className="auth-logo-wrap">G</div>
        <div className="auth-title">Grow Network</div>
        <div className="auth-subtitle">CPA Platform</div>
      </div>

      {/* Tab switcher */}
      <div className="auth-tabs-row">
        <button className="auth-tab-btn active">Sign in</button>
        <Link to="/register" className="auth-tab-btn">Create account</Link>
      </div>

      {/* Body */}
      <div className="auth-body">
        {error && <div className="auth-error">{error}</div>}

        {/* Email + password */}
        <form onSubmit={handleEmail} style={{ display: 'contents' }}>
          <div className="auth-section">
            <div className="auth-row">
              <div className="auth-row-icon blue">✉</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="auth-row">
              <div className="auth-row-icon gray">🔒</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button className="auth-btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div className="auth-or">or continue with</div>

        {/* Social */}
        <div className="auth-social-list">
          <button className="auth-social-row" onClick={handleTelegram} disabled={loading} type="button">
            <div className="auth-social-ico tg">
              <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" />
            </div>
            {isTelegramApp ? 'Continue with Telegram' : 'Telegram'}
            <span className="soc-chevron">›</span>
          </button>

          <GoogleButton
            onSuccess={handleGoogleSuccess}
            onError={msg => setError(msg)}
            disabled={loading}
            label="Google"
            renderAs="row"
          />

          <WalletButton
            onSuccess={role => redirect(role)}
            onError={msg => setError(msg)}
            disabled={loading}
            renderAs="row"
          />
        </div>

        <p className="auth-footer-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
