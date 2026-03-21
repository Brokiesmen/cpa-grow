import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import GoogleButton from '../components/GoogleButton'
import WalletButton from '../components/WalletButton'
import './Auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const redirect = (role) => {
    if (role === 'PUBLISHER') navigate('/publisher')
    else if (role === 'ADVERTISER') navigate('/advertiser')
    else navigate('/admin')
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

  const handleGoogleSuccess = async (accessToken) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/google', { idToken: accessToken })
      redirect(data.user.role)
    } catch (err) {
      const code = err.response?.data?.error
      if (code === 'GOOGLE_AUTH_NOT_CONFIGURED') setError('Google login not configured yet')
      else setError(err.response?.data?.message || 'Google login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleTelegram = () => {
    if (!import.meta.env.VITE_TELEGRAM_BOT_NAME) {
      setError('Telegram login is not configured yet')
      return
    }
    window.TelegramLoginCallback = async (data) => {
      setLoading(true)
      setError('')
      try {
        const res = await api.post('/auth/telegram', data)
        redirect(res.data.user.role)
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
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">G</div>
          <span className="auth-logo-name">Grow Network</span>
        </div>

        <div className="auth-tabs">
          <button className="auth-tab active">Sign in</button>
          <Link to="/register" className="auth-tab" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Create account
          </Link>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleEmail} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">✉</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">🔒</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>

        <div className="auth-divider">or continue with</div>

        <div className="auth-social-grid">
          <GoogleButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
            disabled={loading}
            label="Continue with Google"
          />

          <button className="auth-social-btn telegram" onClick={handleTelegram} disabled={loading}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" />
            Continue with Telegram
          </button>

          <WalletButton
            onSuccess={(role) => redirect(role)}
            onError={(msg) => setError(msg)}
            disabled={loading}
          />
        </div>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
