import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import api from '../../api/client'
import StatCard from '../../components/StatCard'
import Badge from '../../components/Badge'

const fmt = n => n == null ? '—' : Number(n).toLocaleString()
const fmtUSD = n => n == null ? '—' : '$' + Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric' })

// Generate mock chart data when API has no data yet
function mockChartData() {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const clicks = Math.round(80 + Math.random() * 120)
    const conversions = Math.round(clicks * (0.02 + Math.random() * 0.04))
    return {
      date: fmtDate(d),
      clicks,
      conversions,
      revenue: +(conversions * (120 + Math.random() * 60)).toFixed(2)
    }
  })
}

export default function PublisherDashboard() {
  const [stats, setStats] = useState(null)
  const [chart, setChart] = useState([])
  const [conversions, setConversions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiKey = JSON.parse(localStorage.getItem('user') || '{}')?.profile?.apiKey

    Promise.all([
      api.get('/v1/stats').catch(() => ({ data: [] })),
      api.get('/v1/balance').catch(() => ({ data: [] })),
      api.get('/publisher/disputes').catch(() => ({ data: { data: [] } })),
    ]).then(([statsRes, balRes, dispRes]) => {
      const rows = statsRes.data || []

      const totClicks = rows.reduce((s, r) => s + (r.clicks || 0), 0)
      const totConvs = rows.reduce((s, r) => s + (r.conversions || 0), 0)
      const totRev = rows.reduce((s, r) => s + (r.revenue || 0), 0)
      const usdBal = balRes.data?.find?.(b => b.currency === 'USD')

      setStats({
        clicks: totClicks,
        conversions: totConvs,
        revenue: totRev,
        balance: usdBal?.available ?? 0,
        openDisputes: dispRes.data?.meta?.total ?? 0
      })

      const chartData = rows.length > 0
        ? rows.slice(-14).map(r => ({ date: fmtDate(r.date), clicks: r.clicks, conversions: r.conversions, revenue: r.revenue }))
        : mockChartData()
      setChart(chartData)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Loading...</span></div>

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            <span style={{ textTransform: 'capitalize' }}>{p.name}:</span>
            <strong>{p.name === 'revenue' ? '$' + Number(p.value).toFixed(2) : p.value}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Dashboard</div>
        <div className="page-subtitle">Last 30 days performance</div>
      </div>

      {/* Stat Cards */}
      <div className="grid-4">
        <StatCard label="Total Revenue" value={fmtUSD(stats?.revenue)} sub="last 30d" color="green" icon="$" />
        <StatCard label="Clicks" value={fmt(stats?.clicks)} sub="total" color="blue" icon="↗" />
        <StatCard label="Conversions" value={fmt(stats?.conversions)} sub="approved" color="amber" icon="✓" />
        <StatCard label="Balance (USD)" value={fmtUSD(stats?.balance)} sub="available" color="green" icon="◎" />
      </div>

      {/* Charts */}
      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-header">Revenue (14 days)</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#rev)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Clicks vs Conversions</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="clicks" stroke="var(--accent)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="conversions" stroke="var(--green)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-4" style={{ fontSize: 12, color: 'var(--text-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 2 }} />
                Clicks
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 2, background: 'var(--green)', display: 'inline-block', borderRadius: 2 }} />
                Conversions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex gap-3">
        <Link to="/publisher/offers" className="btn btn-primary">Browse Offers</Link>
        <Link to="/publisher/balance" className="btn btn-secondary">Request Payout</Link>
        <Link to="/publisher/disputes" className="btn btn-secondary">
          My Disputes
          {stats?.openDisputes > 0 && (
            <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, padding: '0 6px', fontSize: 11 }}>
              {stats.openDisputes}
            </span>
          )}
        </Link>
      </div>
    </div>
  )
}
