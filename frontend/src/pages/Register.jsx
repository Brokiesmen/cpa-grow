import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import GoogleButton from '../components/GoogleButton'
import WalletButton from '../components/WalletButton'
import WalletRegisterComplete from '../components/WalletRegisterComplete'
import './Auth.css'

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', role: 'PUBLISHER', username: '', referralCode: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [usernameModal, setUsernameModal] = useState(null)
  const [modalUsername, setModalUsername] = useState('')
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const redirect = role => {
    if (role === 'PUBLISHER') navigate('/publisher')
    else navigate('/advertiser')
  }

  const handleEmail = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', form)
      setDone(true)
    } catch (err) {
      const code = err.response?.data?.error
      if (code === 'EMAIL_TAKEN') setError('Email already registered')
      else if (code === 'USERNAME_TAKEN') setError('Username is taken')
      else setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const completeOAuth = async () => {
    if (!modalUsername || modalUsername.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    setLoading(true)
    setError('')
    const { provider, data } = usernameModal
    try {
      let res
      if (provider === 'google') {
        res = await api.post('/auth/google', { ...data, role: form.role, username: modalUsername })
      } else if (provider === 'telegram') {
        res = await api.post('/auth/telegram', { ...data, role: form.role, username: modalUsername })
      }
      if (res?.data?.access_token) {
        const user = await loginWithToken(res.data.access_token, res.data.user)
        redirect(user.role)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async accessToken => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/google', { idToken: accessToken, role: form.role })
      const user = await loginWithToken(res.data.access_token, res.data.user)
      redirect(user.role)
    } catch (err) {
      if (err.response?.data?.error === 'USERNAME_REQUIRED') {
        setUsernameModal({ provider: 'google', data: { idToken: accessToken } })
      } else {
        setError(err.response?.data?.message || 'Google registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTelegram = () => {
    if (!import.meta.env.VITE_TELEGRAM_BOT_NAME) {
      setError('Telegram login is not configured yet')
      return
    }
    window.TelegramLoginCallback = async data => {
      setLoading(true)
      setError('')
      try {
        const res = await api.post('/auth/telegram', { ...data, role: form.role })
        const user = await loginWithToken(res.data.access_token, res.data.user)
        redirect(user.role)
      } catch (err) {
        if (err.response?.data?.error === 'USERNAME_REQUIRED') {
          setUsernameModal({ provider: 'telegram', data })
        } else {
          setError(err.response?.data?.message || 'Telegram registration failed')
        }
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

  // ── Success screen ──
  if (done) return (
    <div className="auth-wrap">
      <div className="auth-header">
        <div className="auth-success-icon">✓</div>
        <div className="auth-title">Account submitted!</div>
        <div className="auth-subtitle">
          Awaiting admin approval.<br />You'll be notified once approved.
        </div>
      </div>
      <div className="auth-body">
        <Link to="/login" className="auth-btn-primary" style={{ textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  )

  return (
    <div className="auth-wrap">

      {/* Username bottom sheet for OAuth */}
      {usernameModal && (
        <div className="auth-sheet-overlay" onClick={() => { setUsernameModal(null); setError('') }}>
          <div className="auth-sheet" onClick={e => e.stopPropagation()}>
            <div className="auth-sheet-handle" />
            <div className="auth-sheet-title">Choose a username</div>
            <div className="auth-sheet-sub">This will be your public handle on the platform</div>
            {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="auth-section" style={{ marginBottom: 16 }}>
              <div className="auth-row">
                <div className="auth-row-icon blue">@</div>
                <input
                  value={modalUsername}
                  onChange={e => setModalUsername(e.target.value)}
                  placeholder="yourhandle"
                  minLength={3}
                  autoFocus
                  autoComplete="off"
                />
              </div>
            </div>
            {usernameModal.provider === 'wallet' ? (
              <WalletRegisterComplete
                address={usernameModal.data.address}
                username={modalUsername}
                role={form.role}
                onSuccess={role => redirect(role)}
                onError={msg => setError(msg)}
                onCancel={() => { setUsernameModal(null); setError('') }}
              />
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="auth-btn-secondary"
                  onClick={() => { setUsernameModal(null); setError('') }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  className="auth-btn-primary"
                  onClick={completeOAuth}
                  disabled={loading}
                  style={{ flex: 2 }}
                >
                  {loading ? <span className="spinner" /> : 'Complete registration'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="auth-header">
        <div className="auth-logo-wrap">G</div>
        <div className="auth-title">Grow Network</div>
        <div className="auth-subtitle">CPA Platform</div>
      </div>

      {/* Tab switcher */}
      <div className="auth-tabs-row">
        <Link to="/login" className="auth-tab-btn">Sign in</Link>
        <button className="auth-tab-btn active">Create account</button>
      </div>

      {/* Body */}
      <div className="auth-body">
        {error && !usernameModal && <div className="auth-error">{error}</div>}

        {/* Role selector */}
        <div className="auth-role-grid" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`auth-role-btn${form.role === 'PUBLISHER' ? ' active' : ''}`}
            onClick={() => set('role')({ target: { value: 'PUBLISHER' } })}
          >
            <span className="role-icon">📢</span>
            <span className="role-name">Publisher</span>
            <span className="role-desc">Drive traffic, earn payouts</span>
          </button>
          <button
            type="button"
            className={`auth-role-btn${form.role === 'ADVERTISER' ? ' active' : ''}`}
            onClick={() => set('role')({ target: { value: 'ADVERTISER' } })}
          >
            <span className="role-icon">🎯</span>
            <span className="role-name">Advertiser</span>
            <span className="role-desc">Launch offers & campaigns</span>
          </button>
        </div>

        {/* Form fields */}
        <div className="auth-section">
          <div className="auth-row">
            <div className="auth-row-icon blue">✉</div>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="Email"
              required
              autoComplete="email"
            />
          </div>
          {form.role === 'PUBLISHER' && (
            <div className="auth-row">
              <div className="auth-row-icon blue">@</div>
              <input
                value={form.username}
                onChange={set('username')}
                placeholder="Username"
                required
                minLength={3}
                autoComplete="off"
              />
            </div>
          )}
          <div className="auth-row">
            <div className="auth-row-icon gray">🔒</div>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Password (min 8 chars)"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {form.role === 'PUBLISHER' && (
            <div className="auth-row">
              <div className="auth-row-icon gray">🎁</div>
              <input
                value={form.referralCode}
                onChange={set('referralCode')}
                placeholder="Referral code (optional)"
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <button className="auth-btn-primary" onClick={handleEmail} disabled={loading}>
          {loading ? <span className="spinner" /> : `Join as ${form.role === 'PUBLISHER' ? 'Publisher' : 'Advertiser'}`}
        </button>

        <div className="auth-or">or continue with</div>

        {/* Social */}
        <div className="auth-social-list">
          <button className="auth-social-row" onClick={handleTelegram} disabled={loading} type="button">
            <div className="auth-social-ico tg">
              <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" />
            </div>
            Telegram
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
            role={form.role}
            isRegister={true}
            onSuccess={role => redirect(role)}
            onError={msg => setError(msg)}
            onUsernameRequired={address => setUsernameModal({ provider: 'wallet', data: { address } })}
            disabled={loading}
            renderAs="row"
          />
        </div>

        <p className="auth-footer-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
