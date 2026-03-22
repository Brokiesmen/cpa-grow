import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'

// Auth
import Login from './pages/Login'
import Register from './pages/Register'

// Publisher
import PublisherDashboard from './pages/publisher/Dashboard'
import PublisherOffers from './pages/publisher/Offers'
import PublisherConversions from './pages/publisher/Conversions'
import PublisherDisputes from './pages/publisher/Disputes'
import PublisherBalance from './pages/publisher/Balance'
import PublisherStats from './pages/publisher/Stats'

// Advertiser
import AdvertiserDashboard from './pages/advertiser/Dashboard'
import AdvertiserDisputes from './pages/advertiser/Disputes'
import AdvertiserSandbox from './pages/advertiser/Sandbox'
import AdvertiserSettings from './pages/advertiser/Settings'

// Publisher (settings)
import PublisherSettings from './pages/publisher/Settings'

// Admin
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminUserDetail from './pages/admin/UserDetail'
import AdminOffers from './pages/admin/Offers'
import AdminPayouts from './pages/admin/Payouts'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#dc2626' }}>Something went wrong</h2>
        <pre style={{ marginTop: 12, fontSize: 12, color: '#6b7280', whiteSpace: 'pre-wrap' }}>
          {this.state.error.message}
        </pre>
        <button onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
          Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

function roleHome(role) {
  if (role === 'PUBLISHER') return '/publisher'
  if (role === 'ADVERTISER') return '/advertiser'
  return '/admin'
}

/** Redirects to cabinet if already authenticated (used for /login, /register) */
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (user) return <Navigate to={roleHome(user.role)} replace />
  return children
}

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={roleHome(user.role)} replace />
  return <Layout>{children}</Layout>
}

function Root() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={roleHome(user.role)} replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<Root />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

              {/* Publisher */}
              <Route path="/publisher" element={<PrivateRoute role="PUBLISHER"><PublisherDashboard /></PrivateRoute>} />
              <Route path="/publisher/offers" element={<PrivateRoute role="PUBLISHER"><PublisherOffers /></PrivateRoute>} />
              <Route path="/publisher/conversions" element={<PrivateRoute role="PUBLISHER"><PublisherConversions /></PrivateRoute>} />
              <Route path="/publisher/disputes" element={<PrivateRoute role="PUBLISHER"><PublisherDisputes /></PrivateRoute>} />
              <Route path="/publisher/balance" element={<PrivateRoute role="PUBLISHER"><PublisherBalance /></PrivateRoute>} />
              <Route path="/publisher/stats" element={<PrivateRoute role="PUBLISHER"><PublisherStats /></PrivateRoute>} />
              <Route path="/publisher/settings" element={<PrivateRoute role="PUBLISHER"><PublisherSettings /></PrivateRoute>} />

              {/* Advertiser */}
              <Route path="/advertiser" element={<PrivateRoute role="ADVERTISER"><AdvertiserDashboard /></PrivateRoute>} />
              <Route path="/advertiser/disputes" element={<PrivateRoute role="ADVERTISER"><AdvertiserDisputes /></PrivateRoute>} />
              <Route path="/advertiser/sandbox" element={<PrivateRoute role="ADVERTISER"><AdvertiserSandbox /></PrivateRoute>} />
              <Route path="/advertiser/settings" element={<PrivateRoute role="ADVERTISER"><AdvertiserSettings /></PrivateRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<PrivateRoute role="ADMIN"><AdminDashboard /></PrivateRoute>} />
              <Route path="/admin/users" element={<PrivateRoute role="ADMIN"><AdminUsers /></PrivateRoute>} />
              <Route path="/admin/users/:id" element={<PrivateRoute role="ADMIN"><AdminUserDetail /></PrivateRoute>} />
              <Route path="/admin/offers" element={<PrivateRoute role="ADMIN"><AdminOffers /></PrivateRoute>} />
              <Route path="/admin/payouts" element={<PrivateRoute role="ADMIN"><AdminPayouts /></PrivateRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
