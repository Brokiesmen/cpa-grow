import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import Badge from '../../components/Badge'

const fmtDate = s => new Date(s).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AdvertiserSandbox() {
  const [offers, setOffers] = useState([])
  const [conversions, setConversions] = useState([])
  const [generated, setGenerated] = useState(null)
  const [form, setForm] = useState({ offer_id: '', goal: 'default', revenue: '' })
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    // Load advertiser's offers (would need an advertiser offers endpoint)
    api.get('/advertiser/sandbox/conversions')
      .then(r => setConversions(r.data || []))
      .catch(() => {})
  }, [])

  const generateClick = async () => {
    if (!form.offer_id) { toast('Select an offer first', 'error'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/advertiser/sandbox/generate-click', {
        offer_id: form.offer_id, subid1: 'sandbox-test'
      })
      setGenerated(data)
      toast('Test click generated!', 'success')
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const sendPostback = async () => {
    if (!generated) { toast('Generate a click first', 'error'); return }
    setLoading(true)
    try {
      await api.post('/advertiser/sandbox/send-postback', {
        click_id: generated.click_id,
        goal: form.goal,
        revenue: form.revenue ? parseFloat(form.revenue) : undefined
      })
      toast('Test conversion created!', 'success')
      const r = await api.get('/advertiser/sandbox/conversions')
      setConversions(r.data || [])
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Integration Sandbox</div>
        <div className="page-subtitle">Test your postback integration without affecting real data</div>
      </div>

      <div className="grid-2">
        {/* Generator */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">⊙ Step 1 — Generate Test Click</div>
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Offer ID</label>
                <input className="form-input" value={form.offer_id}
                  onChange={set('offer_id')} placeholder="Paste your offer UUID" />
              </div>
              <button className="btn btn-primary" onClick={generateClick} disabled={loading}>
                {loading ? <span className="spinner" /> : '⊙ Generate Click'}
              </button>
            </div>
          </div>

          {generated && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header" style={{ color: 'var(--green)' }}>✓ Click Generated</div>
              <div className="card-body">
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>CLICK ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--bg)', padding: '8px 12px', borderRadius: 6 }}>
                    {generated.click_id}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>TEST POSTBACK URL</div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 11,
                    background: 'var(--bg)', padding: '8px 12px', borderRadius: 6,
                    wordBreak: 'break-all', lineHeight: 1.6, color: 'var(--accent)'
                  }}>
                    {generated.postback_url}
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: 10, background: 'var(--amber-bg)', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                  💡 {generated.instructions?.note}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">⊙ Step 2 — Send Test Postback</div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Goal</label>
                  <input className="form-input" value={form.goal} onChange={set('goal')} placeholder="default, ftd, install..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Revenue (optional)</label>
                  <input className="form-input" type="number" value={form.revenue} onChange={set('revenue')} placeholder="200" />
                </div>
              </div>
              <button className="btn btn-primary" onClick={sendPostback} disabled={loading || !generated}>
                {loading ? <span className="spinner" /> : '↯ Fire Postback'}
              </button>
              {!generated && <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 12 }}>Generate a click first</span>}
            </div>
          </div>
        </div>

        {/* Conversions log */}
        <div className="card">
          <div className="card-header">
            Test Conversions
            <button className="btn btn-secondary btn-sm"
              onClick={() => api.get('/advertiser/sandbox/conversions').then(r => setConversions(r.data || []))}>
              ↻ Refresh
            </button>
          </div>
          {conversions.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">⊙</div>
              <p>No sandbox conversions yet.<br />Follow steps on the left to test.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Click ID</th><th>Goal</th><th>Payout</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {conversions.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>
                        {c.click_id?.slice(0, 12)}
                      </td>
                      <td><span className="badge badge-blue">{c.goal}</span></td>
                      <td style={{ fontWeight: 600 }}>${c.payout}</td>
                      <td><Badge status={c.status} /></td>
                      <td style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
