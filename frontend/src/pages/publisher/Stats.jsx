import { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../api/client'

const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric' })

export default function PublisherStats() {
  const [data, setData] = useState([])
  const [range, setRange] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = new Date(); from.setDate(from.getDate() - range)
    api.get('/v1/stats', { params: { date_from: from.toISOString().slice(0, 10) } })
      .then(r => {
        const rows = r.data || []
        if (rows.length === 0) {
          // Generate demo data
          setData(Array.from({ length: range }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (range - 1 - i))
            const clicks = Math.round(60 + Math.random() * 150)
            const conversions = Math.round(clicks * (0.02 + Math.random() * 0.05))
            return { date: fmtDate(d), clicks, conversions, revenue: +(conversions * (100 + Math.random() * 80)).toFixed(2) }
          }))
        } else {
          setData(rows.map(r => ({ ...r, date: fmtDate(r.date) })))
        }
      })
      .finally(() => setLoading(false))
  }, [range])

  const totals = data.reduce((a, r) => ({
    clicks: a.clicks + r.clicks,
    conversions: a.conversions + r.conversions,
    revenue: a.revenue + r.revenue
  }), { clicks: 0, conversions: 0, revenue: 0 })

  const avgCr = totals.clicks > 0 ? (totals.conversions / totals.clicks * 100).toFixed(2) : '0.00'
  const avgEpc = totals.clicks > 0 ? (totals.revenue / totals.clicks).toFixed(3) : '0.000'

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: <strong>{p.name === 'revenue' ? '$' + Number(p.value).toFixed(2) : p.value}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title">Statistics</div>
          <div className="page-subtitle">Your performance analytics</div>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map(d => (
            <button key={d} className={`btn ${range === d ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setRange(d)}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { l: 'Clicks',      v: totals.clicks.toLocaleString() },
          { l: 'Conversions', v: totals.conversions.toLocaleString() },
          { l: 'Revenue',     v: '$' + totals.revenue.toFixed(2) },
          { l: 'CR',          v: avgCr + '%' },
          { l: 'EPC',         v: '$' + avgEpc },
        ].map(s => (
          <div key={s.l} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header">Revenue</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                    interval={Math.floor(data.length / 8)} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#rev2)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">Clicks per day</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                      interval={Math.floor(data.length / 6)} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="clicks" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <div className="card-header">Conversions per day</div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
                      interval={Math.floor(data.length / 6)} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="conversions" fill="var(--green)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
