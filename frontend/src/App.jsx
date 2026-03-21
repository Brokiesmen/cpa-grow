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

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function Root() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'PUBLISHER') return <Navigate to="/publisher" replace />
  if (user.role === 'ADVERTISER') return <Navigate to="/advertiser" replace />
  return <Navigate to="/admin" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Root />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Publisher */}
            <Route path="/publisher" element={<PrivateRoute role="PUBLISHER"><PublisherDashboard /></PrivateRoute>} />
            <Route path="/publisher/offers" element={<PrivateRoute role="PUBLISHER"><PublisherOffers /></PrivateRoute>} />
            <Route path="/publisher/conversions" element={<PrivateRoute role="PUBLISHER"><PublisherConversions /></PrivateRoute>} />
            <Route path="/publisher/disputes" element={<PrivateRoute role="PUBLISHER"><PublisherDisputes /></PrivateRoute>} />
            <Route path="/publisher/balance" element={<PrivateRoute role="PUBLISHER"><PublisherBalance /></PrivateRoute>} />
            <Route path="/publisher/stats" element={<PrivateRoute role="PUBLISHER"><PublisherStats /></PrivateRoute>} />

            {/* Advertiser */}
            <Route path="/advertiser" element={<PrivateRoute role="ADVERTISER"><AdvertiserDashboard /></PrivateRoute>} />
            <Route path="/advertiser/disputes" element={<PrivateRoute role="ADVERTISER"><AdvertiserDisputes /></PrivateRoute>} />
            <Route path="/advertiser/sandbox" element={<PrivateRoute role="ADVERTISER"><AdvertiserSandbox /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
