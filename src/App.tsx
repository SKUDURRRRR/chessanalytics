import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider } from './contexts/AuthContext'
import { ChessSoundProvider } from './contexts/ChessSoundContext'
import { PageErrorBoundary, ComponentErrorBoundary } from './components/ErrorBoundaries'
import { Navigation } from './components/Navigation'
import { Footer } from './components/Footer'
import LoadingModal from './components/LoadingModal'

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
const TermsOfServicePage = lazyWithRetry(() => import('./pages/TermsOfServicePage'))
const PrivacyPolicyPage = lazyWithRetry(() => import('./pages/PrivacyPolicyPage'))
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'))
const CoachDashboardPage = lazyWithRetry(() => import('./pages/coach/CoachDashboardPage'))
const LessonsPage = lazyWithRetry(() => import('./pages/coach/LessonsPage'))
const PuzzlesPage = lazyWithRetry(() => import('./pages/coach/PuzzlesPage'))
const LessonViewer = lazyWithRetry(() => import('./components/coach/LessonViewer').then(m => ({ default: m.LessonViewer })))

// Loading component shown while pages load
function PageLoader() {
  return (
    <>
      <div className="min-h-screen bg-slate-950" />
      <LoadingModal
        isOpen={true}
        message="Loading page..."
        subtitle="Please wait"
      />
    </>
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
                  <Route path="/terms" element={<ComponentErrorBoundary><TermsOfServicePage /></ComponentErrorBoundary>} />
                  <Route path="/privacy" element={<ComponentErrorBoundary><PrivacyPolicyPage /></ComponentErrorBoundary>} />
                  <Route path="/coach" element={<ComponentErrorBoundary><CoachDashboardPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/lessons" element={<ComponentErrorBoundary><LessonsPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/lessons/:lessonId" element={<ComponentErrorBoundary><LessonViewer /></ComponentErrorBoundary>} />
                  <Route path="/coach/puzzles" element={<ComponentErrorBoundary><PuzzlesPage /></ComponentErrorBoundary>} />
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
