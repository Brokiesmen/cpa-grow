import { useState, useEffect } from 'react'
import { Copy, Check, RefreshCw, Eye, EyeOff, User, Key, Link2, Shield, Zap, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTelegram } from '../../context/TelegramContext'
import { useToast } from '../../components/Toast'

const TRAFFIC_TYPES = ['SEO', 'PPC', 'SOCIAL', 'EMAIL', 'PUSH', 'NATIVE', 'DISPLAY', 'ADULT', 'OTHER']

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={handleCopy}
      title="Copy"
      style={{ minWidth: 80 }}
    >
      {copied ? <><Check size={13} style={{ color: 'var(--green)' }} /> Copied!</> : <><Copy size={13} /> Copy</>}
    </button>
  )
}

function MonoField({ value, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1,
        fontFamily: 'monospace',
        fontSize: 12,
        background: 'var(--bg)',
        padding: '10px 14px',
        borderRadius: 9,
        border: '1px solid var(--border)',
        color: 'var(--text)',
        wordBreak: 'break-all',
        lineHeight: 1.6,
        minWidth: 0,
      }}>
        {value || '—'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {actions}
      </div>
    </div>
  )
}

export default function PublisherSettings() {
  const toast = useToast()
  const { logout } = useAuth()
  const { isTelegramApp, tg } = useTelegram()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const handleLogout = async () => {
    await logout()
    if (isTelegramApp && tg) {
      tg.close()
    } else {
      navigate('/login')
    }
  }

  // Profile form
  const [profile, setProfile] = useState({ username: '', telegramHandle: '', phone: '', website: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Traffic types
  const [trafficTypes, setTrafficTypes] = useState([])
  const [savingTraffic, setSavingTraffic] = useState(false)

  // Password form
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' })
  const [showPwd, setShowPwd] = useState({ current: false, newPwd: false, confirm: false })
  const [savingPwd, setSavingPwd] = useState(false)

  // API key regen
  const [regenConfirm, setRegenConfirm] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/publisher/settings')
      const d = res.data
      setData(d)
      setProfile({
        username: d.username || '',
        telegramHandle: d.telegramHandle || '',
        phone: d.phone || '',
        website: d.website || '',
      })
      setTrafficTypes(d.trafficTypes || [])
    } catch {
      toast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setP = k => e => setProfile(p => ({ ...p, [k]: e.target.value }))
  const setPw = k => e => setPwd(p => ({ ...p, [k]: e.target.value }))
  const togglePwdVis = k => () => setShowPwd(s => ({ ...s, [k]: !s[k] }))

  const toggleTraffic = type => {
    setTrafficTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      await api.patch('/publisher/settings/profile', {
        username: profile.username,
        telegramHandle: profile.telegramHandle,
        phone: profile.phone,
        website: profile.website,
        trafficTypes,
      })
      toast('Profile saved!', 'success')
    } catch (err) {
      const e = err.response?.data?.error
      toast(e === 'USERNAME_TAKEN' ? 'Username already taken' : 'Failed to save profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    if (!pwd.newPwd || !pwd.confirm) { toast('Fill all password fields', 'error'); return }
    if (pwd.newPwd !== pwd.confirm) { toast('Passwords do not match', 'error'); return }
    if (pwd.newPwd.length < 8) { toast('Password must be at least 8 characters', 'error'); return }
    setSavingPwd(true)
    try {
      await api.post('/publisher/settings/change-password', {
        currentPassword: pwd.current,
        newPassword: pwd.newPwd,
      })
      toast('Password changed!', 'success')
      setPwd({ current: '', newPwd: '', confirm: '' })
    } catch (err) {
      const e = err.response?.data?.error
      if (e === 'WRONG_PASSWORD') toast('Current password is incorrect', 'error')
      else if (e === 'NO_PASSWORD') toast('No password set — use OAuth to authenticate first', 'error')
      else toast('Failed to change password', 'error')
    } finally {
      setSavingPwd(false)
    }
  }

  const regenerateApiKey = async () => {
    if (!regenConfirm) { setRegenConfirm(true); return }
    setRegenerating(true)
    try {
      const res = await api.post('/publisher/settings/regenerate-api-key')
      setData(d => ({ ...d, apiKey: res.data.apiKey }))
      toast('API key regenerated!', 'success')
    } catch {
      toast('Failed to regenerate API key', 'error')
    } finally {
      setRegenerating(false)
      setRegenConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="spinner" />
        </div>
      </div>
    )
  }

  const connectedAccounts = data?.connectedAccounts || {}

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Manage your account preferences and integrations</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Profile Info ── */}
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <User size={14} style={{ color: 'var(--accent)' }} /> Profile Info
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="settings-profile-grid">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  value={profile.username}
                  onChange={setP('username')}
                  placeholder="your_username"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telegram Handle</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-2)', fontSize: 13, pointerEvents: 'none',
                  }}>@</span>
                  <input
                    className="form-input"
                    style={{ paddingLeft: 26 }}
                    value={profile.telegramHandle}
                    onChange={setP('telegramHandle')}
                    placeholder="username"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  value={profile.phone}
                  onChange={setP('phone')}
                  placeholder="+1 234 567 8900"
                  type="tel"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Website URL</label>
                <input
                  className="form-input"
                  value={profile.website}
                  onChange={setP('website')}
                  placeholder="https://yoursite.com"
                  type="url"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Traffic Types ── */}
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Zap size={14} style={{ color: 'var(--accent)' }} /> Traffic Types
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 400 }}>
              {trafficTypes.length} selected
            </span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>
              Select all traffic types you work with. This helps advertisers find the right publishers.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {TRAFFIC_TYPES.map(type => {
                const active = trafficTypes.includes(type)
                return (
                  <button
                    key={type}
                    onClick={() => toggleTraffic(type)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border-2)',
                      background: active ? 'var(--accent-bg)' : 'rgba(0,0,0,.15)',
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all .15s ease',
                      letterSpacing: '.3px',
                      userSelect: 'none',
                    }}
                  >
                    {type}
                  </button>
                )
              })}
            </div>
            <button
              className="btn btn-primary"
              onClick={saveProfile}
              disabled={savingProfile}
              style={{ minWidth: 140 }}
            >
              {savingProfile
                ? <span className="spinner" style={{ width: 15, height: 15 }} />
                : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ── API Key ── */}
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Key size={14} style={{ color: 'var(--accent)' }} /> API Key
            </span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
              Use this key to authenticate API requests. Keep it secret — do not share publicly.
            </div>
            <MonoField
              value={data?.apiKey}
              actions={[
                <CopyButton key="copy" text={data?.apiKey} />,
                <button
                  key="regen"
                  className={`btn btn-sm ${regenConfirm ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={regenerateApiKey}
                  disabled={regenerating}
                  style={{ minWidth: regenConfirm ? 120 : 100 }}
                >
                  {regenerating
                    ? <span className="spinner" style={{ width: 13, height: 13 }} />
                    : regenConfirm
                      ? 'Confirm Regen'
                      : <><RefreshCw size={13} /> Regenerate</>}
                </button>
              ]}
            />
            {regenConfirm && (
              <div style={{
                marginTop: 10, padding: '10px 14px',
                background: 'var(--red-bg)', border: '1px solid rgba(229,57,53,.25)',
                borderRadius: 9, fontSize: 12, color: 'var(--red)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <span>This will invalidate your current API key. Are you sure?</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRegenConfirm(false)}
                  style={{ flexShrink: 0 }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Referral Code ── */}
        {data?.referralCode && (
          <div className="card">
            <div className="card-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Link2 size={14} style={{ color: 'var(--accent)' }} /> Referral Code
              </span>
            </div>
            <div className="card-body">
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
                Share this code with other publishers to earn referral bonuses.
              </div>
              <MonoField
                value={data.referralCode}
                actions={[<CopyButton key="copy" text={data.referralCode} />]}
              />
            </div>
          </div>
        )}

        {/* ── Connected Accounts ── */}
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Shield size={14} style={{ color: 'var(--accent)' }} /> Connected Accounts
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  key: 'telegram',
                  label: 'Telegram',
                  desc: 'Login via Telegram Mini App',
                  color: '#2AABEE',
                  bg: 'rgba(42,171,238,.12)',
                },
                {
                  key: 'google',
                  label: 'Google',
                  desc: 'Login via Google OAuth',
                  color: '#ea4335',
                  bg: 'rgba(234,67,53,.12)',
                },
                {
                  key: 'wallet',
                  label: 'Wallet',
                  desc: 'Login via Web3 wallet (WalletConnect)',
                  color: '#a78bfa',
                  bg: 'rgba(167,139,250,.12)',
                },
              ].map(({ key, label, desc, color, bg }) => {
                const connected = connectedAccounts[key]
                return (
                  <div key={key} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(0,0,0,.15)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    gap: 12,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{desc}</div>
                    </div>
                    <span
                      className="badge"
                      style={connected
                        ? { background: bg, color, border: `1px solid ${color}40` }
                        : { background: 'rgba(255,255,255,.05)', color: 'var(--text-3)', border: '1px solid var(--border)' }
                      }
                    >
                      {connected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Change Password ── */}
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Key size={14} style={{ color: 'var(--accent)' }} /> Change Password
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }}>
              {data?.hasPassword && (
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={showPwd.current ? 'text' : 'password'}
                      value={pwd.current}
                      onChange={setPw('current')}
                      placeholder="Enter current password"
                      style={{ paddingRight: 42 }}
                    />
                    <button
                      type="button"
                      onClick={togglePwdVis('current')}
                      style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-2)',
                        cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                      }}
                    >
                      {showPwd.current ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPwd.newPwd ? 'text' : 'password'}
                    value={pwd.newPwd}
                    onChange={setPw('newPwd')}
                    placeholder="Min 8 characters"
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={togglePwdVis('newPwd')}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-2)',
                      cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showPwd.newPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPwd.confirm ? 'text' : 'password'}
                    value={pwd.confirm}
                    onChange={setPw('confirm')}
                    placeholder="Repeat new password"
                    style={{ paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={togglePwdVis('confirm')}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-2)',
                      cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showPwd.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {pwd.newPwd && pwd.confirm && pwd.newPwd !== pwd.confirm && (
                <div style={{ fontSize: 12, color: 'var(--red)' }}>Passwords do not match</div>
              )}
              <div>
                <button
                  className="btn btn-primary"
                  onClick={changePassword}
                  disabled={savingPwd}
                  style={{ minWidth: 160 }}
                >
                  {savingPwd
                    ? <span className="spinner" style={{ width: 15, height: 15 }} />
                    : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Выход */}
        <div className="card" style={{ borderColor: 'rgba(229,57,53,.2)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>Sign Out</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                {isTelegramApp ? 'Close the app and end your session' : 'End your current session'}
              </div>
            </div>
            <button className="btn btn-danger" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
