import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  ListChecks,
  ArrowLeftRight,
  MessageSquareWarning,
  Wallet,
  BarChart3,
  Megaphone,
  Users,
  BadgeDollarSign,
  FileCheck2,
  FlaskConical,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react'
import './Layout.css'

const NAV = {
  PUBLISHER: [
    { to: '/publisher',              label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/publisher/offers',       label: 'Offers',       icon: ListChecks },
    { to: '/publisher/conversions',  label: 'Conversions',  icon: ArrowLeftRight },
    { to: '/publisher/disputes',     label: 'Disputes',     icon: MessageSquareWarning },
    { to: '/publisher/balance',      label: 'Balance',      icon: Wallet },
    { to: '/publisher/stats',        label: 'Statistics',   icon: BarChart3 },
    { to: '/publisher/settings',     label: 'Settings',     icon: Settings },
  ],
  ADVERTISER: [
    { to: '/advertiser',             label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/advertiser/offers',      label: 'My Offers',    icon: Megaphone },
    { to: '/advertiser/applications',label: 'Applications', icon: ListChecks },
    { to: '/advertiser/disputes',    label: 'Disputes',     icon: MessageSquareWarning },
    { to: '/advertiser/sandbox',     label: 'Sandbox',      icon: FlaskConical },
    { to: '/advertiser/settings',    label: 'Settings',     icon: Settings },
  ],
  ADMIN: [
    { to: '/admin',                  label: 'Overview',     icon: LayoutDashboard },
    { to: '/admin/users',            label: 'Users',        icon: Users },
    { to: '/admin/offers',           label: 'Offers',       icon: Megaphone },
    { to: '/admin/payouts',          label: 'Payouts',      icon: BadgeDollarSign },
    { to: '/admin/disputes',         label: 'Disputes',     icon: MessageSquareWarning },
    { to: '/admin/agreements',       label: 'Agreements',   icon: FileCheck2 },
  ]
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = NAV[user?.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__logo">
          <span className="sidebar__logo-mark">G</span>
          {!collapsed && <span className="sidebar__logo-text">Grow Network</span>}
        </div>

        <nav className="sidebar__nav">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/publisher' || item.to === '/advertiser' || item.to === '/admin'}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              >
                <span className="sidebar__icon"><Icon size={18} strokeWidth={1.8} /></span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar__bottom">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            {!collapsed && (
              <div className="sidebar__user-info">
                <div className="sidebar__user-email">{user?.email}</div>
                <div className="sidebar__user-role">{user?.role}</div>
              </div>
            )}
          </div>
          <button className="sidebar__logout" onClick={handleLogout} title="Logout">
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>

        <button className="sidebar__toggle" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      <main className="main">
        <div className="main__inner">
          {children}
        </div>
      </main>
    </div>
  )
}
