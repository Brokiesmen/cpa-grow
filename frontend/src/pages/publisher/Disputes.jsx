import { useState, useEffect } from 'react'
import api from '../../api/client'
import Badge from '../../components/Badge'
import { useToast } from '../../components/Toast'

const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })

export default function PublisherDisputes() {
  const [disputes, setDisputes] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [openModal, setOpenModal] = useState(false)
  const [form, setForm] = useState({ reason: '' })
  const [msgText, setMsgText] = useState('')
  const toast = useToast()

  const load = () => {
    setLoading(true)
    api.get('/publisher/disputes')
      .then(r => { setDisputes(r.data.data || []); setMeta(r.data.meta || {}) })
      .catch(() => toast('Failed to load disputes', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const sendMessage = async () => {
    if (!msgText.trim()) return
    try {
      await api.post(`/publisher/disputes/${selected.id}/messages`, { message: msgText })
      setMsgText('')
      // Reload selected dispute
      const { data } = await api.get(`/publisher/disputes/${selected.id}`)
      setSelected(data)
      toast('Message sent', 'success')
    } catch { toast('Failed to send', 'error') }
  }

  const openDispute = async (conversionId) => {
    if (!form.reason.trim()) { toast('Please provide a reason', 'error'); return }
    try {
      await api.post(`/publisher/conversions/${conversionId}/dispute`, { reason: form.reason })
      toast('Dispute opened!', 'success')
      setOpenModal(false)
      setForm({ reason: '' })
      load()
    } catch (err) {
      const e = err.response?.data?.error
      const msgs = { WINDOW_EXPIRED: 'Dispute window expired (7 days)', DUPLICATE: 'Dispute already exists', INVALID_STATUS: 'Only rejected conversions can be disputed' }
      toast(msgs[e] || 'Failed to open dispute', 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title">Disputes</div>
          <div className="page-subtitle">Manage your conversion disputes</div>
        </div>
      </div>

      <div className="grid-2">
        {/* List */}
        <div className="card">
          <div className="card-header">All Disputes <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>({meta.total || 0})</span></div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          ) : disputes.length === 0 ? (
            <div className="empty"><div className="empty-icon">⊿</div><p>No disputes yet</p></div>
          ) : (
            <div>
              {disputes.map(d => (
                <div key={d.id}
                  onClick={() => setSelected(d)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selected?.id === d.id ? 'var(--accent-bg)' : 'transparent',
                    transition: 'background .1s'
                  }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>
                      {d.id?.slice(0, 8)}
                    </span>
                    <Badge status={d.status} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                    Conv: {d.conversion?.id?.slice(0, 8)} — ${Number(d.conversion?.payout || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(d.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="card">
          {!selected ? (
            <div className="empty"><div className="empty-icon">⊿</div><p>Select a dispute to view details</p></div>
          ) : (
            <>
              <div className="card-header">
                Dispute #{selected.id?.slice(0, 8)}
                <Badge status={selected.status} />
              </div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>Your reason:</div>
                <div style={{ fontSize: 13 }}>{selected.publisherReason}</div>
                {selected.advertiserReply && (
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>ADVERTISER REPLY</div>
                    <div style={{ fontSize: 13 }}>{selected.advertiserReply}</div>
                  </div>
                )}
                {selected.adminNote && (
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--amber-bg)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>ADMIN NOTE</div>
                    <div style={{ fontSize: 13 }}>{selected.adminNote}</div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div style={{ padding: '12px 20px', flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>MESSAGES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {selected.messages?.map(m => (
                    <div key={m.id} style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: m.authorRole === 'PUBLISHER' ? 'var(--accent-bg)' : 'var(--bg)',
                      alignSelf: m.authorRole === 'PUBLISHER' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%'
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{m.authorRole}</div>
                      <div style={{ fontSize: 13 }}>{m.message}</div>
                    </div>
                  ))}
                </div>

                {!['CLOSED', 'RESOLVED_FOR_PUBLISHER', 'RESOLVED_FOR_ADVERTISER'].includes(selected.status) && (
                  <div className="flex gap-2 mt-4">
                    <input className="form-input flex-1" value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      placeholder="Add a message..." />
                    <button className="btn btn-primary" onClick={sendMessage}>Send</button>
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
