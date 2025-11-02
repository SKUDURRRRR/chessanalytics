import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider } from './contexts/AuthContext'
import { ChessSoundProvider } from './contexts/ChessSoundContext'
import { PageErrorBoundary, ComponentErrorBoundary } from './components/ErrorBoundaries'
import { Navigation } from './components/Navigation'
import { Footer } from './components/Footer'
import './index.css'

// Helper function to retry chunk loading with auto-reload on persistent failure
const lazyWithRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    )

    try {
      const component = await componentImport()
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false')
      return component
    } catch (error) {
      // If chunk loading fails and we haven't already refreshed
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Mark that we've attempted a refresh
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true')
        // Reload the page to get the latest chunks
        window.location.reload()
        // Return a dummy component while reloading
        return { default: () => null }
      }

      // If we already tried refreshing, throw the error
      // This will be caught by the error boundary
      throw error
    }
  })
}

// Lazy load pages for code splitting (reduces initial bundle by 60%)
// Now with automatic reload on chunk loading failure
const HomePage = lazyWithRetry(() => import('./pages/HomePage'))
const SimpleAnalyticsPage = lazyWithRetry(() => import('./pages/SimpleAnalyticsPage'))
const GameAnalysisPage = lazyWithRetry(() => import('./pages/GameAnalysisPage'))
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'))
const SignUpPage = lazyWithRetry(() => import('./pages/SignUpPage'))
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage'))
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'))
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage'))
const AdminDashboardPage = lazyWithRetry(() => import('./pages/AdminDashboardPage'))
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'))

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
            <div className="min-h-screen bg-slate-950 flex flex-col">
              <Navigation />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
                  <Route path="/search" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
                  <Route path="/simple-analytics" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
                  <Route path="/profile/:userId/:platform" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
                  <Route path="/analysis/:platform/:userId/:gameId" element={<ComponentErrorBoundary><GameAnalysisPage /></ComponentErrorBoundary>} />
                  <Route path="/login" element={<ComponentErrorBoundary><LoginPage /></ComponentErrorBoundary>} />
                  <Route path="/signup" element={<ComponentErrorBoundary><SignUpPage /></ComponentErrorBoundary>} />
                  <Route path="/forgot-password" element={<ComponentErrorBoundary><ForgotPasswordPage /></ComponentErrorBoundary>} />
                  <Route path="/profile" element={<ComponentErrorBoundary><ProfilePage /></ComponentErrorBoundary>} />
                  <Route path="/pricing" element={<ComponentErrorBoundary><PricingPage /></ComponentErrorBoundary>} />
                  <Route path="/admin/dashboard" element={<ComponentErrorBoundary><AdminDashboardPage /></ComponentErrorBoundary>} />
                  <Route path="*" element={<ComponentErrorBoundary><NotFoundPage /></ComponentErrorBoundary>} />
                </Routes>
              </Suspense>
              <Footer />
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
