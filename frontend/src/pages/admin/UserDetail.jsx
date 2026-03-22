import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api/client'
import { useToast } from '../../components/Toast'

const STATUS_BADGE = {
  ACTIVE: 'badge-green', PENDING: 'badge-amber', BANNED: 'badge-red', SUSPENDED: 'badge-gray',
}
const ROLE_BADGE = {
  ADMIN: 'badge-blue', PUBLISHER: 'badge-green', ADVERTISER: 'badge-amber',
}
const fmtDate = s => s ? new Date(s).toLocaleString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtUSD = n => n == null ? '—' : '$' + Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Row({ label, value }) {
  return (
    <div className="flex" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 16 }}>
      <div style={{ width: 180, color: 'var(--text-2)', fontSize: 13, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{value ?? '—'}</div>
    </div>
  )
}

export default function AdminUserDetail() {
  const { id } = useParams()
  const [user, setUser]     = useState(null)
  const [audit, setAudit]   = useState([])
  const [loading, setLoading] = useState(true)
  const [newStatus, setNewStatus] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = useToast()

  useEffect(() => {
    Promise.all([
      api.get(`/admin/users/${id}`),
      api.get(`/admin/users/${id}/audit`)
    ]).then(([uRes, aRes]) => {
      setUser(uRes.data)
      setNewStatus(uRes.data.status)
      setAudit(aRes.data.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const saveStatus = async () => {
    setSaving(true)
    try {
      const updated = await api.patch(`/admin/users/${id}/status`, { status: newStatus, reason })
      setUser(u => ({ ...u, status: updated.data.status }))
      showToast('Status updated', 'success')
      setReason('')
    } catch (e) {
      showToast(e.response?.data?.message || 'Error', 'error')
    } finally {
      setSaving(false)
    }
  }

  const forceLogout = async () => {
    if (!confirm('Terminate all sessions for this user?')) return
    try {
      await api.post(`/admin/users/${id}/logout-all`)
      showToast('All sessions terminated', 'success')
    } catch {
      showToast('Error', 'error')
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Loading...</span></div>
  if (!user) return <div className="card" style={{ padding: 24, color: 'var(--red)' }}>User not found</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link to="/admin/users" style={{ color: 'var(--accent)', fontSize: 13 }}>← Back to Users</Link>
        <div className="page-title" style={{ marginTop: 8 }}>{user.email}</div>
        <div className="flex gap-2" style={{ marginTop: 6 }}>
          <span className={`badge ${ROLE_BADGE[user.role] || 'badge-gray'}`}>{user.role}</span>
          <span className={`badge ${STATUS_BADGE[user.status] || 'badge-gray'}`}>{user.status}</span>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
        {/* Account info */}
        <div className="card">
          <div className="card-header">Account Info</div>
          <div className="card-body">
            <Row label="User ID"       value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{user.id}</span>} />
            <Row label="Email"         value={user.email} />
            <Row label="Role"          value={<span className={`badge ${ROLE_BADGE[user.role]}`}>{user.role}</span>} />
            <Row label="Status"        value={<span className={`badge ${STATUS_BADGE[user.status]}`}>{user.status}</span>} />
            <Row label="Registered"    value={fmtDate(user.createdAt)} />
            <Row label="Last Login"    value={fmtDate(user.lastLoginAt)} />
            <Row label="Google Auth"   value={user.googleId ? '✓ Connected' : '✗ Not connected'} />
            <Row label="Telegram"      value={user.telegramId ? '✓ Connected' : '✗ Not connected'} />
            <Row label="Wallet"        value={user.walletAddress ? <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{user.walletAddress}</span> : null} />
          </div>
        </div>

        {/* Profile info */}
        <div className="card">
          <div className="card-header">
            {user.role === 'PUBLISHER' ? 'Publisher Profile' : user.role === 'ADVERTISER' ? 'Advertiser Profile' : 'Profile'}
          </div>
          <div className="card-body">
            {user.publisher && <>
              <Row label="Username"      value={user.publisher.username} />
              <Row label="Telegram"      value={user.publisher.telegram} />
              <Row label="Website"       value={user.publisher.website} />
              <Row label="Traffic Types" value={user.publisher.trafficTypes?.join(', ')} />
              <Row label="TQS Score"     value={user.publisher.tqs} />
              <Row label="Tracking Links" value={user.publisher._count?.trackingLinks} />
              <Row label="Applications"  value={user.publisher._count?.applications} />
              <Row label="Conversions"   value={user.publisher._count?.conversions} />
              <Row label="Payouts"       value={user.publisher._count?.payouts} />
            </>}
            {user.advertiser && <>
              <Row label="Company"       value={user.advertiser.companyName} />
              <Row label="Website"       value={user.advertiser.website} />
              <Row label="Balance"       value={fmtUSD(user.advertiser.balance)} />
              <Row label="On Hold"       value={fmtUSD(user.advertiser.holdAmount)} />
              <Row label="Total Offers"  value={user.advertiser._count?.offers} />
            </>}
            {!user.publisher && !user.advertiser && (
              <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', paddingTop: 20 }}>No profile</div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Quick Actions</div>
        <div className="card-body">
          <div className="flex gap-3 items-center admin-actions-row" style={{ flexWrap: "wrap" }}>
            <select className="form-input form-select" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: 150 }}>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BANNED">Banned</option>
            </select>
            <input
              className="form-input"
              placeholder="Reason (optional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button
              className="btn btn-primary"
              onClick={saveStatus}
              disabled={saving || newStatus === user.status}
            >
              {saving ? 'Saving...' : 'Update Status'}
            </button>
            <button className="btn btn-danger" onClick={forceLogout}>
              Force Logout
            </button>
          </div>
        </div>
      </div>

      {/* Audit log */}
      {audit.length > 0 && (
        <div className="card">
          <div className="card-header">Audit Log</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Admin ID</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.action}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>{log.adminId?.slice(0, 8)}…</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>
                      {log.before ? JSON.stringify(log.before) : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>
                      {log.after ? JSON.stringify(log.after) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{fmtDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
