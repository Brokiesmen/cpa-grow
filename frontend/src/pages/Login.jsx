import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'
import { BrowserProvider } from 'ethers'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import api from '../api/client'
import './Auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider('eip155')

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

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError('')
      try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        }).then(r => r.json())
        const { data } = await api.post('/auth/google', {
          idToken: tokenResponse.access_token,
          sub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name
        })
        redirect(data.user.role)
      } catch (err) {
        const code = err.response?.data?.error
        if (code === 'GOOGLE_AUTH_NOT_CONFIGURED') setError('Google login not configured. Use email/password.')
        else setError(err.response?.data?.message || 'Google login failed')
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Google login was cancelled')
  })

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

  const signInWithWallet = async () => {
    if (!address) return
    setLoading(true)
    setError('')
    try {
      const { data: nonceData } = await api.get(`/auth/wallet/nonce?address=${address}`)
      const provider = new BrowserProvider(walletProvider)
      const signer = await provider.getSigner()
      const signature = await signer.signMessage(nonceData.message)
      const res = await api.post('/auth/wallet', { address, signature })
      redirect(res.data.user.role)
    } catch (err) {
      setError(err.response?.data?.message || 'Wallet login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleWalletConnect = async () => {
    setError('')
    if (!isConnected) {
      await open()
    } else {
      await signInWithWallet()
    }
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
          <button className="auth-social-btn" onClick={() => handleGoogle()} disabled={loading}>
            <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" />
            Continue with Google
          </button>

          <button className="auth-social-btn telegram" onClick={handleTelegram} disabled={loading}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" alt="Telegram" />
            Continue with Telegram
          </button>

          <button className="auth-social-btn wallet" onClick={handleWalletConnect} disabled={loading}>
            <img src="https://avatars.githubusercontent.com/u/37784886" alt="WalletConnect" style={{ borderRadius: 4 }} />
            {isConnected
              ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
              : 'Connect Web3 Wallet'}
          </button>

          {isConnected && (
            <button className="auth-submit" onClick={signInWithWallet} disabled={loading} style={{ marginTop: 0 }}>
              {loading ? <span className="spinner" /> : 'Sign in with Wallet ↗'}
            </button>
          )}
        </div>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}
