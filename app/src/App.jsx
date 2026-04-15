import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth }    from './context/AuthContext'
import { PortfolioProvider }        from './context/PortfolioContext'
import { LangProvider }             from './context/LangContext'
import Navbar      from './components/Navbar'
import Dashboard   from './pages/Dashboard'
import OcrImport   from './pages/OcrImport'
import Agent       from './pages/Agent'
import Login       from './pages/Login'
import Register    from './pages/Register'

// Renders only when authenticated; redirects to /login otherwise
function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid var(--border)', borderTopColor: 'var(--gold)',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return (
    <PortfolioProvider>
      <Navbar />
      <Routes>
        <Route path="/"       element={<Dashboard />} />
        <Route path="/import" element={<OcrImport />} />
        <Route path="/agent"  element={<Agent />} />
        <Route path="*"       element={<Navigate to="/" replace />} />
      </Routes>
    </PortfolioProvider>
  )
}

// Redirects to home if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/*"        element={<ProtectedLayout />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  )
}
