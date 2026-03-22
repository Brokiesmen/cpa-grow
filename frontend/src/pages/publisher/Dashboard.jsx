import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts'
import {
  DollarSign, MousePointerClick, CheckCircle2, Wallet,
  TrendingUp, ArrowRight, AlertCircle
} from 'lucide-react'
import api from '../../api/client'
import StatCard from '../../components/StatCard'

const fmt = n => n == null ? '—' : Number(n).toLocaleString()
const fmtUSD = n => n == null ? '—' : '$' + Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric' })

function EmptyChart() {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
      No data yet — start driving traffic to see stats here
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ textTransform: 'capitalize', color: 'var(--text-2)' }}>{p.name}:</span>
          <strong>{p.name === 'revenue' ? '$' + Number(p.value).toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function PublisherDashboard() {
  const [stats, setStats] = useState(null)
  const [chart, setChart] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/v1/stats'),
      api.get('/v1/balance'),
      api.get('/publisher/disputes'),
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
      setChart(rows.length > 0
        ? rows.slice(-14).map(r => ({ date: fmtDate(r.date), clicks: r.clicks, conversions: r.conversions, revenue: r.revenue }))
        : [])
    }).catch(err => {
      setError(err.response?.data?.message || 'Failed to load dashboard data')
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Loading...</span></div>

  if (error) return (
    <div className="page">
      <div className="card" style={{ color: 'var(--red)', padding: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <AlertCircle size={18} /> {error}
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Last 30 days performance</div>
        </div>
        <div className="page-header-actions">
          <Link to="/publisher/offers" className="btn btn-primary" style={{ gap: 6 }}>
            Browse Offers <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid-4 stagger">
        <StatCard label="Total Revenue" value={fmtUSD(stats?.revenue)} sub="last 30d" color="green" icon={DollarSign} />
        <StatCard label="Clicks" value={fmt(stats?.clicks)} sub="total" color="blue" icon={MousePointerClick} />
        <StatCard label="Conversions" value={fmt(stats?.conversions)} sub="approved" color="amber" icon={CheckCircle2} />
        <StatCard label="Balance (USD)" value={fmtUSD(stats?.balance)} sub="available" color="green" icon={Wallet} />
      </div>

      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <TrendingUp size={15} style={{ color: 'var(--accent)' }} /> Revenue (14 days)
            </span>
          </div>
          <div className="card-body">
            {chart.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2.5} fill="url(#rev)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Clicks vs Conversions</div>
          <div className="card-body">
            {chart.length === 0 ? <EmptyChart /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="clicks" stroke="var(--accent)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="conversions" stroke="var(--green)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-4" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 3, background: 'var(--accent)', display: 'inline-block', borderRadius: 2 }} />
                    Clicks
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 3, background: 'var(--green)', display: 'inline-block', borderRadius: 2 }} />
                    Conversions
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3 flex-mobile-wrap">
        <Link to="/publisher/balance" className="btn btn-secondary" style={{ flex: '1 1 auto' }}>
          <Wallet size={15} /> Request Payout
        </Link>
        <Link to="/publisher/disputes" className="btn btn-secondary" style={{ flex: '1 1 auto' }}>
          <AlertCircle size={15} /> My Disputes
          {stats?.openDisputes > 0 && (
            <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, marginLeft: 2 }}>
              {stats.openDisputes}
            </span>
          )}
        </Link>
      </div>
    </div>
  )
}
