import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
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

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const redirect = (role) => {
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
      if (res?.data?.user) redirect(res.data.user.role)
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (accessToken) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/google', { idToken: accessToken, role: form.role })
      redirect(res.data.user.role)
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
    window.TelegramLoginCallback = async (data) => {
      setLoading(true)
      setError('')
      try {
        const res = await api.post('/auth/telegram', { ...data, role: form.role })
        redirect(res.data.user.role)
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

  if (done) return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>Registration submitted</h2>
        <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 13 }}>
          Your account is awaiting admin approval.<br />You'll be notified once approved.
        </p>
        <Link to="/login" className="auth-submit"
          style={{ display: 'block', lineHeight: '48px', textDecoration: 'none', textAlign: 'center' }}>
          Back to Login
        </Link>
      </div>
    </div>
  )

  return (
    <div className="auth-wrap">
      {usernameModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal-card">
            <div className="auth-modal-title">Choose a username</div>
            <div className="auth-modal-sub">This will be your public handle on the platform</div>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field" style={{ marginBottom: 16 }}>
              <label className="auth-label">Username</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">@</span>
                <input value={modalUsername} onChange={e => setModalUsername(e.target.value)}
                  placeholder="yourhandle" minLength={3} />
              </div>
            </div>
            {usernameModal.provider === 'wallet' ? (
              <WalletRegisterComplete
                address={usernameModal.data.address}
                username={modalUsername}
                role={form.role}
                onSuccess={(role) => redirect(role)}
                onError={(msg) => setError(msg)}
                onCancel={() => { setUsernameModal(null); setError('') }}
              />
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="auth-social-btn"
                  onClick={() => { setUsernameModal(null); setError('') }}
                  style={{ flex: 1 }}>Cancel</button>
                <button className="auth-submit" onClick={completeOAuth} disabled={loading}
                  style={{ flex: 2 }}>
                  {loading ? <span className="spinner" /> : 'Complete registration'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">G</div>
          <span className="auth-logo-name">Grow Network</span>
        </div>

        <div className="auth-tabs">
          <Link to="/login" className="auth-tab" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Sign in
          </Link>
          <button className="auth-tab active">Create account</button>
        </div>

        {error && !usernameModal && <div className="auth-error">{error}</div>}

        <form onSubmit={handleEmail} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">I am a</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">👤</span>
              <select value={form.role} onChange={set('role')}>
                <option value="PUBLISHER">Publisher (Webmaster)</option>
                <option value="ADVERTISER">Advertiser</option>
              </select>
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">✉</span>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="you@example.com" required />
            </div>
          </div>
          {form.role === 'PUBLISHER' && (
            <div className="auth-field">
              <label className="auth-label">Username</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">@</span>
                <input value={form.username} onChange={set('username')}
                  placeholder="yourhandle" required minLength={3} />
              </div>
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">🔒</span>
              <input type="password" value={form.password} onChange={set('password')}
                placeholder="Min 8 characters" required minLength={8} />
            </div>
          </div>
          {form.role === 'PUBLISHER' && (
            <div className="auth-field">
              <label className="auth-label">Referral code <span style={{ color: '#9ca3af' }}>(optional)</span></label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">🎁</span>
                <input value={form.referralCode} onChange={set('referralCode')} placeholder="abc12345" />
              </div>
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">or register with</div>

        <div className="auth-social-grid">
          <GoogleButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
            disabled={loading}
            label="Register with Google"
          />

          <button className="auth-social-btn telegram" onClick={handleTelegram} disabled={loading}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" />
            Register with Telegram
          </button>

          <WalletButton
            role={form.role}
            isRegister={true}
            onSuccess={(role) => redirect(role)}
            onError={(msg) => setError(msg)}
            onUsernameRequired={(address) => setUsernameModal({ provider: 'wallet', data: { address } })}
            disabled={loading}
          />
        </div>

        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
