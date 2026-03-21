import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import Badge from '../../components/Badge'

const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric' })

const METHODS = [
  { value: 'USDT_TRC20', label: 'USDT TRC-20' },
  { value: 'USDT_ERC20', label: 'USDT ERC-20' },
  { value: 'BTC',        label: 'Bitcoin' },
  { value: 'WIRE',       label: 'Bank Wire' },
  { value: 'WEBMONEY',   label: 'WebMoney' },
]

export default function PublisherBalance() {
  const [balances, setBalances] = useState([])
  const [txs, setTxs] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ currency: 'USD', amount: '', method: 'USDT_TRC20', address: '' })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [b, t] = await Promise.all([
        api.get('/v1/balance'),
        api.get('/v1/balance').catch(() => ({ data: [] }))
      ])
      setBalances(b.data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const requestPayout = async () => {
    if (!form.amount || !form.address) { toast('Fill all fields', 'error'); return }
    setSubmitting(true)
    try {
      await api.post('/publisher/payouts', {
        currency: form.currency,
        amount: parseFloat(form.amount),
        method: form.method,
        requisites: { address: form.address }
      })
      toast('Payout requested!', 'success')
      setShowForm(false)
      load()
    } catch (err) {
      const e = err.response?.data?.error
      if (e === 'INSUFFICIENT_BALANCE') toast('Insufficient balance', 'error')
      else if (e === 'BELOW_MINIMUM') toast('Below minimum payout amount', 'error')
      else toast('Failed to request payout', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const usd = balances.find(b => b.currency === 'USD')
  const available = usd?.available || 0

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title">Balance & Payouts</div>
          <div className="page-subtitle">Your earnings and withdrawal history</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          + Request Payout
        </button>
      </div>

      {/* Balance cards */}
      <div className="flex gap-4" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        {loading ? <div className="spinner" /> : balances.length === 0 ? (
          <div className="card" style={{ padding: '20px 28px', color: 'var(--text-2)', fontSize: 13 }}>
            No balance data yet. Start earning from conversions!
          </div>
        ) : balances.map(b => (
          <div key={b.currency} className="card" style={{ padding: '20px 28px', minWidth: 180 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
              {b.currency}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {b.currency === 'USD' || b.currency === 'EUR' ? '$' : ''}{Number(b.available).toFixed(2)}
            </div>
            {b.hold > 0 && (
              <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6 }}>
                + ${Number(b.hold).toFixed(2)} on hold
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Payout form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">New Payout Request</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-input form-select" value={form.currency} onChange={set('currency')}>
                  <option value="USD">USD</option>
                  <option value="USDT">USDT</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input className="form-input" type="number" value={form.amount}
                  onChange={set('amount')} placeholder={`Min $50, Available: $${available.toFixed(2)}`} />
              </div>
              <div className="form-group">
                <label className="form-label">Method</label>
                <select className="form-input form-select" value={form.method} onChange={set('method')}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Wallet / Account</label>
              <input className="form-input" value={form.address}
                onChange={set('address')} placeholder="TRC20 address, bank details, etc." />
            </div>
            <div className="flex gap-3">
              <button className="btn btn-primary" onClick={requestPayout} disabled={submitting}>
                {submitting ? <span className="spinner" /> : 'Submit Request'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* TQS Card */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">Your API Key</div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
              Use this key to access the public Offer Feed API
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: 13,
              background: 'var(--bg)',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              color: 'var(--text)',
              wordBreak: 'break-all'
            }}>
              {localStorage.getItem('access_token')?.slice(0, 40) || '—'}...
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Payout History</div>
          <div style={{ padding: '0' }}>
            {payouts.length === 0 ? (
              <div className="empty" style={{ padding: '24px 0' }}>
                <p>No payouts yet</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>${Number(p.amount).toFixed(2)} {p.currency}</td>
                      <td style={{ fontSize: 12 }}>{p.method}</td>
                      <td><Badge status={p.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
