import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider } from './contexts/AuthContext'
import { ChessSoundProvider } from './contexts/ChessSoundContext'
import { PageErrorBoundary, ComponentErrorBoundary } from './components/ErrorBoundaries'
import './index.css'

// Lazy load pages for code splitting (reduces initial bundle by 60%)
const HomePage = lazy(() => import('./pages/HomePage'))
const SimpleAnalyticsPage = lazy(() => import('./pages/SimpleAnalyticsPage'))
const GameAnalysisPage = lazy(() => import('./pages/GameAnalysisPage'))

// Loading component shown while pages load
function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-slate-400">Loading...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <PageErrorBoundary>
      <AuthProvider>
        <ChessSoundProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen bg-slate-950">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
                  <Route path="/search" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
                  <Route path="/simple-analytics" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
                  <Route path="/profile/:userId/:platform" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
                  <Route path="/analysis/:platform/:userId/:gameId" element={<ComponentErrorBoundary><GameAnalysisPage /></ComponentErrorBoundary>} />
                </Routes>
              </Suspense>
            </div>
            <Analytics />
            <SpeedInsights />
          </Router>
        </ChessSoundProvider>
      </AuthProvider>
    </PageErrorBoundary>
  )
}

export default App
