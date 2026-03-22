import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, LogOut, Shield, UserCog, X } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'

const STATUS_BADGE = {
  ACTIVE:    'badge-green',
  PENDING:   'badge-amber',
  BANNED:    'badge-red',
  SUSPENDED: 'badge-gray',
}
const ROLE_BADGE = {
  ADMIN:      'badge-blue',
  PUBLISHER:  'badge-green',
  ADVERTISER: 'badge-amber',
}

const fmtDate = s => s ? new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6, transition: 'color .15s' }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusModal({ user, onClose, onSaved }) {
  const [status, setStatus] = useState(user.status)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = useToast()

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/admin/users/${user.id}/status`, { status, reason })
      showToast('Status updated', 'success')
      onSaved()
    } catch (e) {
      showToast(e.response?.data?.message || 'Error', 'error')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Change Status — ${user.email}`} onClose={onClose}>
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label className="form-label">New Status</label>
        <select className="form-input form-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 20 }}>
        <label className="form-label">Reason (optional)</label>
        <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for status change..." style={{ resize: 'vertical' }} />
      </div>
      <div className="flex gap-3">
        <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 15, height: 15 }} /> : 'Save'}
        </button>
        <button className="btn btn-secondary" onClick={onClose}><X size={14} /> Cancel</button>
      </div>
    </Modal>
  )
}

function RoleModal({ user, onClose, onSaved }) {
  const [role, setRole] = useState(user.role)
  const [saving, setSaving] = useState(false)
  const showToast = useToast()

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role })
      showToast('Role updated', 'success')
      onSaved()
    } catch (e) {
      showToast(e.response?.data?.message || 'Error', 'error')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`Change Role — ${user.email}`} onClose={onClose}>
      <div className="form-group" style={{ marginBottom: 20 }}>
        <label className="form-label">New Role</label>
        <select className="form-input form-select" value={role} onChange={e => setRole(e.target.value)}>
          <option value="PUBLISHER">Publisher</option>
          <option value="ADVERTISER">Advertiser</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div className="flex gap-3">
        <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 15, height: 15 }} /> : 'Save'}
        </button>
        <button className="btn btn-secondary" onClick={onClose}><X size={14} /> Cancel</button>
      </div>
    </Modal>
  )
}

export default function AdminUsers() {
  const [users, setUsers]       = useState([])
  const [meta, setMeta]         = useState({ total: 0, page: 1, per_page: 30 })
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [roleFilter, setRole]   = useState('')
  const [statusFilter, setStatus] = useState('')
  const [page, setPage]         = useState(1)
  const [statusModal, setStatusModal] = useState(null)
  const [roleModal, setRoleModal]     = useState(null)
  const showToast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 30 }
    if (search) params.search = search
    if (roleFilter) params.role = roleFilter
    if (statusFilter) params.status = statusFilter
    api.get('/admin/users', { params })
      .then(r => { setUsers(r.data.data); setMeta(r.data.meta) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const handleLogoutAll = async (user) => {
    if (!confirm(`Force logout all sessions for ${user.email}?`)) return
    try {
      await api.post(`/admin/users/${user.id}/logout-all`)
      showToast('All sessions terminated', 'success')
    } catch { showToast('Error', 'error') }
  }

  const totalPages = Math.ceil(meta.total / (meta.per_page || 30))

  return (
    <div className="page">
      {statusModal && (
        <StatusModal user={statusModal} onClose={() => setStatusModal(null)} onSaved={() => { setStatusModal(null); load() }} />
      )}
      {roleModal && (
        <RoleModal user={roleModal} onClose={() => setRoleModal(null)} onSaved={() => { setRoleModal(null); load() }} />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">{meta.total} users total</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 14 }}>
        <span style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Search size={14} />
        </span>
        <input
          className="form-input"
          placeholder="Search by email or name..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: '2 1 200px' }}
        />
        <select className="form-input form-select" value={roleFilter} onChange={e => { setRole(e.target.value); setPage(1) }}>
          <option value="">All Roles</option>
          <option value="PUBLISHER">Publisher</option>
          <option value="ADVERTISER">Advertiser</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select className="form-input form-select" value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Profile</th>
                <th>Registered</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/admin/users/${u.id}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>{u.email}</Link>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[u.status] || 'badge-gray'}`}>{u.status}</span></td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                    {u.publisher?.username || u.advertiser?.companyName || '—'}
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "—"}</td>
                  <td>
                    <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setStatusModal(u)} title="Change status">
                        <Shield size={13} />
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setRoleModal(u)} title="Change role">
                        <UserCog size={13} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleLogoutAll(u)} title="Force logout">
                        <LogOut size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination" style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="pagination-info">Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
