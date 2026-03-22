import { useState, useEffect } from 'react'
import { MessageSquareWarning, Send } from 'lucide-react'
import api from '../../api/client'
import Badge from '../../components/Badge'
import { useToast } from '../../components/Toast'

const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })

export default function PublisherDisputes() {
  const [disputes, setDisputes] = useState([])
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
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
    setSending(true)
    try {
      await api.post(`/publisher/disputes/${selected.id}/messages`, { message: msgText })
      setMsgText('')
      const { data } = await api.get(`/publisher/disputes/${selected.id}`)
      setSelected(data)
      toast('Message sent', 'success')
    } catch { toast('Failed to send', 'error') }
    finally { setSending(false) }
  }

  const isClosed = s => ['CLOSED', 'RESOLVED_FOR_PUBLISHER', 'RESOLVED_FOR_ADVERTISER'].includes(s)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Disputes</div>
          <div className="page-subtitle">Manage your conversion disputes</div>
        </div>
      </div>

      <div className="grid-2 disputes-layout">
        {/* List */}
        <div className="card">
          <div className="card-header">
            All Disputes
            <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 13 }}>({meta.total || 0})</span>
          </div>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" /></div>
          ) : disputes.length === 0 ? (
            <div className="empty">
              <MessageSquareWarning size={32} style={{ opacity: .3, marginBottom: 10 }} />
              <p>No disputes yet</p>
            </div>
          ) : (
            <div>
              {disputes.map(d => (
                <div key={d.id}
                  onClick={() => setSelected(d)}
                  style={{
                    padding: '13px 18px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selected?.id === d.id ? 'var(--accent-bg)' : 'transparent',
                    transition: 'background .15s ease',
                    userSelect: 'none',
                  }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>
                      #{d.id?.slice(0, 8)}
                    </span>
                    <Badge status={d.status} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>
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
            <div className="empty">
              <MessageSquareWarning size={32} style={{ opacity: .3, marginBottom: 10 }} />
              <p>Select a dispute to view details</p>
            </div>
          ) : (
            <>
              <div className="card-header">
                Dispute #{selected.id?.slice(0, 8)}
                <Badge status={selected.status} />
              </div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>Your reason:</div>
                <div style={{ fontSize: 13 }}>{selected.publisherReason}</div>
                {selected.advertiserReply && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 9 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, letterSpacing: '.5px' }}>ADVERTISER REPLY</div>
                    <div style={{ fontSize: 13 }}>{selected.advertiserReply}</div>
                  </div>
                )}
                {selected.adminNote && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--amber-bg)', borderRadius: 9 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', marginBottom: 4, letterSpacing: '.5px' }}>ADMIN NOTE</div>
                    <div style={{ fontSize: 13 }}>{selected.adminNote}</div>
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '.5px' }}>MESSAGES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
                  {(selected.messages || []).map(m => (
                    <div key={m.id} style={{
                      padding: '8px 12px',
                      borderRadius: 9,
                      background: m.authorRole === 'PUBLISHER' ? 'var(--accent-bg)' : 'var(--bg)',
                      alignSelf: m.authorRole === 'PUBLISHER' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      fontSize: 13,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3, fontWeight: 600 }}>{m.authorRole}</div>
                      {m.message}
                    </div>
                  ))}
                </div>

                {!isClosed(selected.status) && (
                  <div className="flex gap-2">
                    <input className="form-input flex-1" value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      placeholder="Add a message..." />
                    <button className="btn btn-primary" onClick={sendMessage} disabled={sending || !msgText.trim()}>
                      {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={15} />}
                    </button>
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
