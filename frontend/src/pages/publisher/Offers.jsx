import { useState, useEffect } from 'react'
import { Filter, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import api from '../../api/client'
import Badge from '../../components/Badge'
import { useToast } from '../../components/Toast'

const VERTICALS = ['', 'GAMBLING', 'CRYPTO', 'NUTRA', 'FINANCE', 'DATING', 'OTHER']
const MODELS = ['', 'CPA', 'CPL', 'CPI', 'REVSHARE']

export default function PublisherOffers() {
  const [offers, setOffers] = useState([])
  const [meta, setMeta] = useState({ total: 0 })
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)
  const [filters, setFilters] = useState({ vertical: '', payment_model: '', page: 1 })
  const toast = useToast()

  const fetchOffers = async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      const { data } = await api.get('/publisher/offers', { params })
      setOffers(data.data || [])
      setMeta(data.meta || {})
    } catch {
      toast('Failed to load offers', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOffers() }, [filters])

  const apply = async (offerId) => {
    setApplying(offerId)
    try {
      await api.post('/publisher/applications', { offer_id: offerId })
      toast('Application submitted!', 'success')
      fetchOffers()
    } catch (err) {
      const e = err.response?.data?.error
      if (e === 'ALREADY_APPLIED') toast('Already applied to this offer', 'info')
      else toast('Failed to apply', 'error')
    } finally {
      setApplying(null)
    }
  }

  const set = k => e => setFilters(f => ({ ...f, [k]: e.target.value, page: 1 }))
  const totalPages = Math.ceil((meta.total || 0) / 50)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Offers</div>
          <div className="page-subtitle">{meta.total || 0} available offers</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div className="filter-bar">
            <span style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Filter size={14} />
            </span>
            <select className="form-input form-select" value={filters.vertical} onChange={set('vertical')}>
              {VERTICALS.map(v => <option key={v} value={v}>{v || 'All verticals'}</option>)}
            </select>
            <select className="form-input form-select" value={filters.payment_model} onChange={set('payment_model')}>
              {MODELS.map(m => <option key={m} value={m}>{m || 'All models'}</option>)}
            </select>
            <input className="form-input" type="number" placeholder="Min payout $"
              onChange={e => setFilters(f => ({ ...f, payout_min: e.target.value || '', page: 1 }))} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" /></div>
        ) : offers.length === 0 ? (
          <div className="empty">
            <ListChecks size={32} style={{ opacity: .3, marginBottom: 10 }} />
            <p>No offers available yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Vertical</th>
                  <th>Model</th>
                  <th>Payout</th>
                  <th>Geo</th>
                  <th>Cap</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {o.preview_url && (
                          <img
                            src={o.preview_url}
                            alt={o.name}
                            style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'var(--surface-2)' }}
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                            Cookie: {o.cookie_lifetime}d
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><Badge status={o.vertical} /></td>
                    <td><span className="badge badge-blue">{o.payment_model}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>${o.payout}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {o.allowed_geos?.slice(0, 4).join(', ')}
                      {o.allowed_geos?.length > 4 && ` +${o.allowed_geos.length - 4}`}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {o.daily_cap ? `${o.daily_cap}/day` : '∞'}
                    </td>
                    <td>
                      {o.application_status
                        ? <Badge status={o.application_status} />
                        : <Badge status={o.status?.toUpperCase()} />}
                    </td>
                    <td>
                      {!o.applied ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => apply(o.id)}
                          disabled={applying === o.id}
                        >
                          {applying === o.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Apply'}
                        </button>
                      ) : o.application_status === 'APPROVED' ? (
                        <button className="btn btn-secondary btn-sm">Get Link</button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Pending</span>
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
          <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="pagination-info">Page {filters.page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={filters.page >= totalPages}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
