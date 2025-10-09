import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { PageErrorBoundary, ComponentErrorBoundary } from './components/ErrorBoundaries'
import HomePage from './pages/HomePage'
import SimpleAnalyticsPage from './pages/SimpleAnalyticsPage'
import GameAnalysisPage from './pages/GameAnalysisPage'
import './index.css'

function App() {
  return (
    <PageErrorBoundary>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="min-h-screen bg-slate-950">
            <Routes>
              <Route path="/" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
              <Route path="/search" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
              <Route path="/simple-analytics" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
              <Route path="/profile/:userId/:platform" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
              <Route path="/analysis/:platform/:userId/:gameId" element={<ComponentErrorBoundary><GameAnalysisPage /></ComponentErrorBoundary>} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </PageErrorBoundary>
  )
}

export default App
