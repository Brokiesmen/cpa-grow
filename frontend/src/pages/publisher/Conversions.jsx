import { useState, useEffect } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../api/client'
import Badge from '../../components/Badge'
import { useToast } from '../../components/Toast'

const fmtDate = s => new Date(s).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function PublisherConversions() {
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    api.get('/v1/conversions', { params: { page, limit: 30 } })
      .then(r => { setRows(r.data.data || []); setMeta(r.data.meta || {}) })
      .catch(() => toast('Failed to load conversions', 'error'))
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.ceil((meta.total || 0) / 30)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Conversions</div>
          <div className="page-subtitle">All your conversion history</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <ArrowLeftRight size={32} style={{ opacity: .3, marginBottom: 10 }} />
            <p>No conversions yet. Apply to offers and start sending traffic!</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Offer</th>
                  <th>Goal</th>
                  <th>Payout</th>
                  <th>Status</th>
                  <th>CTIT</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>
                      {c.id?.slice(0, 8)}
                    </td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.offer?.name || c.offerId?.slice(0, 8)}
                    </td>
                    <td><span className="badge badge-blue">{c.goal || 'default'}</span></td>
                    <td style={{ fontWeight: 700, color: c.status === 'APPROVED' ? 'var(--green)' : 'var(--text)' }}>
                      ${Number(c.payout).toFixed(2)}
                    </td>
                    <td><Badge status={c.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {c.ctitSeconds ? `${c.ctitSeconds}s` : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDate(c.createdAt)}</td>
                    <td>
                      {c.status === 'REJECTED' && (
                        <button className="btn btn-secondary btn-sm">Dispute</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
