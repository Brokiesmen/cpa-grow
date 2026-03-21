import { useState, useEffect } from 'react'
import api from '../../api/client'
import Badge from '../../components/Badge'
import { useToast } from '../../components/Toast'

const VERTICALS = ['', 'GAMBLING', 'CRYPTO', 'NUTRA', 'FINANCE', 'DATING', 'OTHER']
const MODELS = ['', 'CPA', 'CPL', 'CPI', 'REVSHARE']

export default function PublisherOffers() {
  const [offers, setOffers] = useState([])
  const [meta, setMeta] = useState({ total: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ vertical: '', payment_model: '', page: 1 })
  const toast = useToast()

  const fetchOffers = async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      const { data } = await api.get('/v1/offers', { params })
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
    try {
      await api.post('/v1/applications', { offer_id: offerId })
      toast('Application submitted!', 'success')
      fetchOffers()
    } catch (err) {
      const e = err.response?.data?.error
      if (e === 'ALREADY_APPLIED') toast('Already applied to this offer', 'info')
      else toast('Failed to apply', 'error')
    }
  }

  const set = k => e => setFilters(f => ({ ...f, [k]: e.target.value, page: 1 }))

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Offers</div>
        <div className="page-subtitle">{meta.total || 0} available offers</div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body flex gap-3" style={{ flexWrap: 'wrap' }}>
          <select className="form-input form-select" style={{ width: 160 }} value={filters.vertical} onChange={set('vertical')}>
            {VERTICALS.map(v => <option key={v} value={v}>{v || 'All verticals'}</option>)}
          </select>
          <select className="form-input form-select" style={{ width: 150 }} value={filters.payment_model} onChange={set('payment_model')}>
            {MODELS.map(m => <option key={m} value={m}>{m || 'All models'}</option>)}
          </select>
          <input className="form-input" style={{ width: 140 }} type="number" placeholder="Min payout $"
            onChange={e => setFilters(f => ({ ...f, payout_min: e.target.value || '', page: 1 }))} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : offers.length === 0 ? (
          <div className="empty"><div className="empty-icon">⊞</div><p>No offers available yet</p></div>
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
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        Cookie: {o.cookie_lifetime}d
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
                        <button className="btn btn-primary btn-sm" onClick={() => apply(o.id)}>Apply</button>
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

      {/* Pagination */}
      {meta.total > 50 && (
        <div className="flex gap-2 mt-4 items-center" style={{ justifyContent: 'center' }}>
          <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1}
            onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Prev</button>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Page {filters.page} of {Math.ceil(meta.total / 50)}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={filters.page >= Math.ceil(meta.total / 50)}
            onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next →</button>
        </div>
      )}
    </div>
  )
}
