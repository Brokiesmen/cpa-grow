import { useState, useEffect } from 'react'
import { Copy, Check, RefreshCw, Eye, EyeOff, Building2, Key, Shield, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTelegram } from '../../context/TelegramContext'
import { useToast } from '../../components/Toast'

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

export default function AdvertiserSettings() {
  const toast = useToast()
  const { logout } = useAuth()
  const { isTelegramApp } = useTelegram()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // Company form
  const [company, setCompany] = useState({ companyName: '', website: '' })
  const [savingCompany, setSavingCompany] = useState(false)

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
      const res = await api.get('/advertiser/settings')
      const d = res.data
      setData(d)
      setCompany({
        companyName: d.companyName || '',
        website: d.website || '',
      })
    } catch {
      toast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setC = k => e => setCompany(c => ({ ...c, [k]: e.target.value }))
  const setPw = k => e => setPwd(p => ({ ...p, [k]: e.target.value }))
  const togglePwdVis = k => () => setShowPwd(s => ({ ...s, [k]: !s[k] }))

  const saveCompany = async () => {
    setSavingCompany(true)
    try {
      await api.patch('/advertiser/settings/profile', {
        companyName: company.companyName,
        website: company.website,
      })
      toast('Company info saved!', 'success')
    } catch {
      toast('Failed to save company info', 'error')
    } finally {
      setSavingCompany(false)
    }
  }

  const changePassword = async () => {
    if (!pwd.newPwd || !pwd.confirm) { toast('Fill all password fields', 'error'); return }
    if (pwd.newPwd !== pwd.confirm) { toast('Passwords do not match', 'error'); return }
    if (pwd.newPwd.length < 8) { toast('Password must be at least 8 characters', 'error'); return }
    setSavingPwd(true)
    try {
      await api.post('/advertiser/settings/change-password', {
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
      const res = await api.post('/advertiser/settings/regenerate-api-key')
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

        {/* ── Company Info ── */}
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Building2 size={14} style={{ color: 'var(--accent)' }} /> Company Info
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 18 }} className="settings-company-grid">
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  className="form-input"
                  value={company.companyName}
                  onChange={setC('companyName')}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Website URL</label>
                <input
                  className="form-input"
                  value={company.website}
                  onChange={setC('website')}
                  placeholder="https://yoursite.com"
                  type="url"
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={saveCompany}
              disabled={savingCompany}
              style={{ minWidth: 140 }}
            >
              {savingCompany
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
                End your current session
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
