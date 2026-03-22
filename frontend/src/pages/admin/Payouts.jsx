import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, CreditCard, X } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'

const STATUS_BADGE = {
  PENDING:    'badge-amber',
  PROCESSING: 'badge-blue',
  COMPLETED:  'badge-green',
  FAILED:     'badge-red',
  CANCELLED:  'badge-gray',
}

const fmtDate = s => s ? new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtUSD = n => n == null ? '—' : '$' + Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function PayoutModal({ payout, onClose, onSaved }) {
  const [status, setStatus] = useState('PROCESSING')
  const [txHash, setTxHash] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const showToast = useToast()

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/admin/payouts/${payout.id}/status`, { status, txHash: txHash || undefined, note: note || undefined })
      showToast('Payout updated', 'success')
      onSaved()
    } catch (e) {
      showToast(e.response?.data?.message || 'Error', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={17} style={{ color: 'var(--accent)' }} /> Process Payout
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          {payout.publisher?.username || payout.publisher?.user?.email} — {fmtUSD(payout.amount)} {payout.currency} via {payout.method}
        </div>

        {payout.requisites && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px' }}>Requisites</div>
            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.6 }}>
              {typeof payout.requisites === 'object' ? JSON.stringify(payout.requisites, null, 2) : payout.requisites}
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">New Status</label>
          <select className="form-input form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {status === 'COMPLETED' && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">TX Hash (optional)</label>
            <input className="form-input" value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="0x..." style={{ fontFamily: 'monospace' }} />
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Note (optional)</label>
          <textarea className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Internal note..." style={{ resize: 'vertical' }} />
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

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([])
  const [meta, setMeta]       = useState({ total: 0, page: 1, per_page: 30 })
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState('PENDING')
  const [page, setPage]       = useState(1)
  const [modal, setModal]     = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 30 }
    if (status) params.status = status
    api.get('/admin/payouts', { params })
      .then(r => { setPayouts(r.data.data); setMeta(r.data.meta) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, status])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(meta.total / (meta.per_page || 30))

  return (
    <div className="page">
      {modal && (
        <PayoutModal payout={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Payout Management</div>
          <div className="page-subtitle">{meta.total} payouts</div>
        </div>
        <div className="page-header-actions">
          <select className="form-input form-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            style={{ minWidth: 150 }}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Publisher</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Processed</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48 }}><div className="spinner" /></td></tr>
              ) : payouts.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No payouts found</td></tr>
              ) : payouts.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.publisher?.username || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.publisher?.user?.email}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {fmtUSD(p.amount)} <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12 }}>{p.currency}</span>
                  </td>
                  <td><span className="badge badge-gray">{p.method}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>{p.status}</span></td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{fmtDate(p.createdAt)}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{fmtDate(p.processedAt)}</td>
                  <td>
                    <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                      {(p.status === 'PENDING' || p.status === 'PROCESSING') && (
                        <button className="btn btn-sm btn-primary" onClick={() => setModal(p)}>
                          <CreditCard size={13} /> Process
                        </button>
                      )}
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
