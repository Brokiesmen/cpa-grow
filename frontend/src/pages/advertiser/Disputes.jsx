import { useState, useEffect } from 'react'
import api from '../../api/client'
import Badge from '../../components/Badge'
import { useToast } from '../../components/Toast'

const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric' })

export default function AdvertiserDisputes() {
  const [disputes, setDisputes] = useState([])
  const [meta, setMeta] = useState({})
  const [selected, setSelected] = useState(null)
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = () => {
    api.get('/advertiser/disputes')
      .then(r => { setDisputes(r.data.data || []); setMeta(r.data.meta || {}) })
      .catch(() => toast('Failed to load disputes', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const action = async (type) => {
    if (!reply.trim()) { toast('Please add a reply', 'error'); return }
    try {
      await api.post(`/advertiser/disputes/${selected.id}/${type}`, { reply })
      toast(`Dispute ${type}ed!`, 'success')
      setReply('')
      load()
      setSelected(null)
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error')
    }
  }

  const canAct = selected && ['OPEN', 'ESCALATED'].includes(selected.status)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Disputes</div>
        <div className="page-subtitle">Publisher conversion disputes on your offers</div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">Disputes ({meta.total || 0})</div>
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          : disputes.length === 0 ? (
            <div className="empty"><div className="empty-icon">⊿</div><p>No disputes</p></div>
          ) : (
            <div>
              {disputes.map(d => (
                <div key={d.id}
                  onClick={() => setSelected(d)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selected?.id === d.id ? 'var(--accent-bg)' : 'transparent'
                  }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{d.id?.slice(0, 8)}</span>
                    <Badge status={d.status} />
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    Conv: ${Number(d.conversion?.payout || 0).toFixed(2)} — {d.conversion?.goal}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(d.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          {!selected ? (
            <div className="empty"><div className="empty-icon">⊿</div><p>Select a dispute</p></div>
          ) : (
            <>
              <div className="card-header">
                Dispute #{selected.id?.slice(0, 8)}
                <Badge status={selected.status} />
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>PUBLISHER REASON</div>
                <div style={{ fontSize: 13, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                  {selected.publisherReason}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>MESSAGES</div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.messages?.map(m => (
                      <div key={m.id} style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: m.authorRole === 'ADVERTISER' ? 'var(--accent-bg)' : 'var(--bg)',
                        alignSelf: m.authorRole === 'ADVERTISER' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%', fontSize: 13
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>{m.authorRole}</div>
                        {m.message}
                      </div>
                    ))}
                  </div>
                </div>

                {canAct && (
                  <div style={{ marginTop: 16 }}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Your reply</label>
                      <textarea className="form-input" rows={3} value={reply}
                        onChange={e => setReply(e.target.value)} placeholder="Explain your decision..." />
                    </div>
                    <div className="flex gap-3">
                      <button className="btn btn-primary" style={{ background: 'var(--green)' }} onClick={() => action('accept')}>
                        ✓ Accept (Approve conversion)
                      </button>
                      <button className="btn btn-danger" onClick={() => action('reject')}>
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
