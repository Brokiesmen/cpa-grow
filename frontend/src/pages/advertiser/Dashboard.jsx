import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../api/client'
import StatCard from '../../components/StatCard'
import Badge from '../../components/Badge'

const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric' })

function mockData() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return {
      date: fmtDate(d),
      conversions: Math.round(10 + Math.random() * 30),
      spend: +(1000 + Math.random() * 3000).toFixed(0)
    }
  })
}

export default function AdvertiserDashboard() {
  const [stats, setStats] = useState({ offers: 0, conversions: 0, spend: 0, balance: 0, pendingApps: 0 })
  const [chart] = useState(mockData())
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/advertiser/disputes').catch(() => ({ data: { data: [] } })),
    ]).then(([dispRes]) => {
      setDisputes((dispRes.data?.data || []).slice(0, 5))
    }).finally(() => setLoading(false))
  }, [])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name === 'spend' ? '$' : ''}{p.value}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Advertiser Dashboard</div>
        <div className="page-subtitle">Campaign overview</div>
      </div>

      <div className="grid-4">
        <StatCard label="Active Offers" value={stats.offers || '0'} color="blue" icon="⊞" />
        <StatCard label="Conversions (30d)" value={stats.conversions || '0'} color="green" icon="↯" />
        <StatCard label="Spend (30d)" value={`$${stats.spend || '0'}`} color="amber" icon="$" />
        <StatCard label="Balance" value={`$${stats.balance || '0'}`} color="green" icon="◎" />
      </div>

      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-header">Daily Conversions & Spend</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="conversions" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spend" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Recent Disputes
            {disputes.length > 0 && (
              <Link to="/advertiser/disputes" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 400 }}>View all</Link>
            )}
          </div>
          {disputes.length === 0 ? (
            <div className="empty"><div className="empty-icon">⊿</div><p>No open disputes</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {disputes.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.id?.slice(0, 8)}</td>
                      <td><Badge status={d.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link to="/advertiser/offers" className="btn btn-primary">Create Offer</Link>
        <Link to="/advertiser/sandbox" className="btn btn-secondary">⊙ Test Integration</Link>
        <Link to="/advertiser/disputes" className="btn btn-secondary">Disputes</Link>
      </div>
    </div>
  )
}
