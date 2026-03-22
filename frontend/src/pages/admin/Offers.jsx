import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Settings2, X } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'

const STATUS_BADGE = {
  ACTIVE:         'badge-green',
  PENDING_REVIEW: 'badge-amber',
  DRAFT:          'badge-gray',
  PAUSED:         'badge-blue',
  ARCHIVED:       'badge-gray',
}

const fmt = n => n == null ? '—' : Number(n).toLocaleString()
const fmtDate = s => s ? new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function StatusModal({ offer, onClose, onSaved }) {
  const [status, setStatus] = useState('ACTIVE')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = useToast()

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/admin/offers/${offer.id}/status`, { status, note })
      showToast(`Offer ${status.toLowerCase()}`, 'success')
      onSaved()
    } catch (e) {
      showToast(e.response?.data?.message || 'Error', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Change Offer Status</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 18 }}>{offer.name}</div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">New Status</label>
          <select className="form-input form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="ACTIVE">Active (Approve)</option>
            <option value="PAUSED">Paused</option>
            <option value="ARCHIVED">Archived (Reject)</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Note to advertiser (optional)</label>
          <textarea className="form-input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason or feedback..." style={{ resize: 'vertical' }} />
        </div>
        <div className="flex gap-3">
          <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" style={{ width: 15, height: 15 }} /> : 'Save'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}><X size={14} /> Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminOffers() {
  const [offers, setOffers]   = useState([])
  const [meta, setMeta]       = useState({ total: 0, page: 1, per_page: 30 })
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState('PENDING_REVIEW')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [modal, setModal]     = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 30 }
    if (status) params.status = status
    if (search) params.search = search
    api.get('/admin/offers', { params })
      .then(r => { setOffers(r.data.data); setMeta(r.data.meta) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, status, search])

  useEffect(() => { load() }, [load])

  const quickStatus = async (offerId, newStatus) => {
    await api.patch(`/admin/offers/${offerId}/status`, { status: newStatus })
    load()
  }

  const totalPages = Math.ceil(meta.total / (meta.per_page || 30))

  return (
    <div className="page">
      {modal && (
        <StatusModal offer={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Offer Moderation</div>
          <div className="page-subtitle">{meta.total} offers</div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 14 }}>
        <span style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Search size={14} />
        </span>
        <input className="form-input" placeholder="Search by name..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ flex: '2 1 180px' }} />
        <select className="form-input form-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Advertiser</th>
                <th>Status</th>
                <th>Vertical</th>
                <th>Model</th>
                <th>Payout</th>
                <th>Apps</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48 }}><div className="spinner" /></td></tr>
              ) : offers.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No offers found</td></tr>
              ) : offers.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.name}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{o.advertiser?.companyName || o.advertiser?.user?.email || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-gray'}`}>{o.status.replace('_', ' ')}</span></td>
                  <td style={{ color: 'var(--text-2)' }}>{o.vertical}</td>
                  <td style={{ color: 'var(--text-2)' }}>{o.paymentModel}</td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>${Number(o.payout).toFixed(2)}</td>
                  <td style={{ color: 'var(--text-2)' }}>{fmt(o._count?.applications)}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{fmtDate(o.createdAt)}</td>
                  <td>
                    <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                      {o.status === 'PENDING_REVIEW' && (
                        <>
                          <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(69,201,122,.25)' }}
                            onClick={() => quickStatus(o.id, 'ACTIVE')}>
                            <CheckCircle2 size={13} />
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => quickStatus(o.id, 'ARCHIVED')}>
                            <XCircle size={13} />
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-secondary" onClick={() => setModal(o)}>
                        <Settings2 size={13} />
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
