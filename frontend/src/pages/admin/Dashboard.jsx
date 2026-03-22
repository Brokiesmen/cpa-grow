import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, UserPlus, Megaphone, DollarSign,
  MousePointerClick, CheckCircle2, Clock, AlertTriangle,
  MessageSquareWarning, ArrowRight
} from 'lucide-react'
import api from '../../api/client'
import StatCard from '../../components/StatCard'

const fmt = n => n == null ? '—' : Number(n).toLocaleString()
const fmtUSD = n => n == null ? '—' : '$' + Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = s => new Date(s).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })

const STATUS_BADGE = {
  ACTIVE:    'badge-green',
  PENDING:   'badge-amber',
  BANNED:    'badge-red',
  SUSPENDED: 'badge-gray',
}
const ROLE_BADGE = {
  ADMIN:      'badge-blue',
  PUBLISHER:  'badge-green',
  ADVERTISER: 'badge-amber',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-page"><div className="spinner" /><span>Loading...</span></div>
  if (error) return <div className="page"><div className="card" style={{ color: 'var(--red)', padding: 24 }}>{error}</div></div>

  const SectionLabel = ({ children }) => (
    <div style={{ marginBottom: 10, marginTop: 4, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
      {children}
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Admin Overview</div>
          <div className="page-subtitle">Platform statistics — last 30 days</div>
        </div>
      </div>

      <SectionLabel>Users</SectionLabel>
      <div className="grid-4 stagger" style={{ marginBottom: 20 }}>
        <StatCard label="Total Users"    value={fmt(stats.users.total)}                    sub="all time"   color="blue"  icon={Users} />
        <StatCard label="New This Month" value={fmt(stats.users.newThisMonth)}              sub="registered" color="green" icon={UserPlus} />
        <StatCard label="Publishers"     value={fmt(stats.users.byRole?.PUBLISHER)}         sub="accounts"   color="blue"  icon={Users} />
        <StatCard label="Advertisers"    value={fmt(stats.users.byRole?.ADVERTISER)}        sub="accounts"   color="amber" icon={Megaphone} />
      </div>

      <SectionLabel>Traffic & Finance</SectionLabel>
      <div className="grid-4 stagger" style={{ marginBottom: 20 }}>
        <StatCard label="Clicks"          value={fmt(stats.traffic.clicksThisMonth)}        sub="this month" color="blue"  icon={MousePointerClick} />
        <StatCard label="Conversions"     value={fmt(stats.traffic.conversionsThisMonth)}   sub="approved"   color="green" icon={CheckCircle2} />
        <StatCard label="Revenue"         value={fmtUSD(stats.traffic.revenueThisMonth)}    sub="paid out"   color="green" icon={DollarSign} />
        <StatCard label="Pending Payouts" value={fmtUSD(stats.finance.pendingPayoutsAmount)} sub={`${fmt(stats.finance.pendingPayouts)} requests`} color="amber" icon={Clock} />
      </div>

      <SectionLabel>Moderation</SectionLabel>
      <div className="grid-4 stagger" style={{ marginBottom: 24 }}>
        <StatCard label="Pending Offers" value={fmt(stats.offers.pendingReview)}              sub="awaiting review"    color="amber" icon={Megaphone} />
        <StatCard label="Open Disputes"  value={fmt(stats.moderation.openDisputes)}           sub="need attention"     color="red"   icon={MessageSquareWarning} />
        <StatCard label="Fraud Alerts"   value={fmt(stats.moderation.fraudAlertsThisWeek)}   sub="this week"          color="red"   icon={AlertTriangle} />
        <StatCard label="Pending Convs"  value={fmt(stats.traffic.pendingConversions)}        sub="awaiting approval"  color="amber" icon={Clock} />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-mobile-wrap" style={{ marginBottom: 24 }}>
        <Link to="/admin/users"     className="btn btn-primary"   style={{ flex: '1 1 auto' }}><Users size={15} /> Manage Users</Link>
        <Link to="/admin/offers"    className="btn btn-secondary" style={{ flex: '1 1 auto' }}><Megaphone size={15} /> Review Offers</Link>
        <Link to="/admin/payouts"   className="btn btn-secondary" style={{ flex: '1 1 auto' }}><DollarSign size={15} /> Process Payouts</Link>
        <Link to="/admin/disputes"  className="btn btn-secondary" style={{ flex: '1 1 auto' }}>
          <MessageSquareWarning size={15} /> Disputes
          {stats.moderation.openDisputes > 0 && (
            <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, marginLeft: 2 }}>
              {stats.moderation.openDisputes}
            </span>
          )}
        </Link>
      </div>

      {/* Recent registrations */}
      <div className="card">
        <div className="card-header">
          Recent Registrations
          <Link to="/admin/users" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRegistrations.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-3)', textAlign: 'center' }}>No recent registrations</td></tr>
              ) : stats.recentRegistrations.map(u => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/admin/users/${u.id}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>{u.email}</Link>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[u.status] || 'badge-gray'}`}>{u.status}</span></td>
                  <td style={{ color: 'var(--text-2)' }}>{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
