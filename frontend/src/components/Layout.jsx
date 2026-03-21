import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

const NAV = {
  PUBLISHER: [
    { to: '/publisher',              label: 'Dashboard',    icon: '◈' },
    { to: '/publisher/offers',       label: 'Offers',       icon: '⊞' },
    { to: '/publisher/conversions',  label: 'Conversions',  icon: '↯' },
    { to: '/publisher/disputes',     label: 'Disputes',     icon: '⊿' },
    { to: '/publisher/balance',      label: 'Balance',      icon: '◎' },
    { to: '/publisher/stats',        label: 'Statistics',   icon: '▲' },
  ],
  ADVERTISER: [
    { to: '/advertiser',             label: 'Dashboard',    icon: '◈' },
    { to: '/advertiser/offers',      label: 'My Offers',    icon: '⊞' },
    { to: '/advertiser/applications',label: 'Applications', icon: '✉' },
    { to: '/advertiser/disputes',    label: 'Disputes',     icon: '⊿' },
    { to: '/advertiser/sandbox',     label: 'Sandbox',      icon: '⊙' },
  ],
  ADMIN: [
    { to: '/admin',                  label: 'Overview',     icon: '◈' },
    { to: '/admin/disputes',         label: 'Disputes',     icon: '⊿' },
    { to: '/admin/agreements',       label: 'Agreements',   icon: '✦' },
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
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/publisher' || item.to === '/advertiser' || item.to === '/admin'}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
            >
              <span className="sidebar__icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
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
          <button className="sidebar__logout" onClick={handleLogout} title="Logout">⏏</button>
        </div>

        <button className="sidebar__toggle" onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '›' : '‹'}
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
