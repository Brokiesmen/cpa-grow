import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import './Auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const handle = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password)
      if (user.role === 'PUBLISHER') navigate('/publisher')
      else if (user.role === 'ADVERTISER') navigate('/advertiser')
      else navigate('/admin')
    } catch (err) {
      const msg = err.response?.data?.error
      if (msg === 'ACCOUNT_PENDING_APPROVAL') toast('Your account is pending admin approval', 'info')
      else if (msg === 'ACCOUNT_BANNED') toast('Account is banned', 'error')
      else toast('Invalid email or password', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-logo">
          <span className="auth-logo-mark">G</span>
          <span className="auth-logo-name">Grow Network</span>
        </div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">CPA Platform</p>

        <form onSubmit={handle} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register" style={{ color: 'var(--accent)' }}>Register</Link>
        </p>
      </div>
    </div>
  )
}
