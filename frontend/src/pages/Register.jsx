import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useToast } from '../components/Toast'
import './Auth.css'

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', role: 'PUBLISHER', username: '', referralCode: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handle = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      setDone(true)
    } catch (err) {
      const code = err.response?.data?.error
      if (code === 'EMAIL_TAKEN') toast('Email already registered', 'error')
      else if (code === 'USERNAME_TAKEN') toast('Username is taken', 'error')
      else toast('Registration failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="auth-wrap">
      <div className="auth-card card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <h2 style={{ marginBottom: 8 }}>Registration submitted</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 24, fontSize: 13 }}>
          Your account is awaiting admin approval.<br />You'll be notified once approved.
        </p>
        <Link to="/login" className="btn btn-primary">Back to Login</Link>
      </div>
    </div>
  )

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-logo">
          <span className="auth-logo-mark">G</span>
          <span className="auth-logo-name">Grow Network</span>
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Join the CPA Platform</p>

        <form onSubmit={handle} className="auth-form">
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input form-select" value={form.role} onChange={set('role')}>
              <option value="PUBLISHER">Publisher (Webmaster)</option>
              <option value="ADVERTISER">Advertiser</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email}
              onChange={set('email')} placeholder="you@example.com" required />
          </div>
          {form.role === 'PUBLISHER' && (
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" value={form.username}
                onChange={set('username')} placeholder="yourhandle" required minLength={3} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={form.password}
              onChange={set('password')} placeholder="Min 8 characters" required minLength={8} />
          </div>
          {form.role === 'PUBLISHER' && (
            <div className="form-group">
              <label className="form-label">Referral code <span style={{ color: 'var(--text-3)' }}>(optional)</span></label>
              <input className="form-input" value={form.referralCode}
                onChange={set('referralCode')} placeholder="abc12345" />
            </div>
          )}
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already registered? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
