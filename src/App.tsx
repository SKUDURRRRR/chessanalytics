import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ChessSoundProvider } from './contexts/ChessSoundContext'
import { ToastProvider } from './contexts/ToastContext'
import { PageErrorBoundary, ComponentErrorBoundary } from './components/ErrorBoundaries'
import { Navigation } from './components/Navigation'
import { Footer } from './components/Footer'
import LoadingModal from './components/LoadingModal'
import { AccountSetupModal } from './components/AccountSetupModal'

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
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'))
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'))
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage'))
const TermsOfServicePage = lazyWithRetry(() => import('./pages/TermsOfServicePage'))
const PrivacyPolicyPage = lazyWithRetry(() => import('./pages/PrivacyPolicyPage'))
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'))
const CoachDashboardPage = lazyWithRetry(() => import('./pages/coach/CoachDashboardPage'))
const LessonsPage = lazyWithRetry(() => import('./pages/coach/LessonsPage'))
const PuzzlesPage = lazyWithRetry(() => import('./pages/coach/PuzzlesPage'))
const PuzzleSolvePage = lazyWithRetry(() => import('./pages/coach/PuzzleSolvePage'))
const PlayWithCoachPage = lazyWithRetry(() => import('./pages/coach/PlayWithCoachPage'))
const ProgressPage = lazyWithRetry(() => import('./pages/coach/ProgressPage'))
const PositionLibraryPage = lazyWithRetry(() => import('./pages/coach/PositionLibraryPage'))
const GameReviewPage = lazyWithRetry(() => import('./pages/coach/GameReviewPage'))

// Loading component shown while pages load
function PageLoader() {
  return (
    <>
      <div className="min-h-screen bg-surface-base" />
      <LoadingModal isOpen={true} branded />
    </>
  )
}

// Route guard: requires authentication (waits for auth to initialize)
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Route guard: redirects authenticated users away (e.g., login/signup pages)
function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <PageErrorBoundary>
      <ToastProvider>
      <AuthProvider>
        <ChessSoundProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen bg-surface-base flex flex-col">
              <Navigation />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
                  <Route path="/search" element={<ComponentErrorBoundary><HomePage /></ComponentErrorBoundary>} />
                  <Route path="/simple-analytics" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
                  <Route path="/profile/:userId/:platform" element={<ComponentErrorBoundary><SimpleAnalyticsPage /></ComponentErrorBoundary>} />
                  <Route path="/analysis/:platform/:userId/:gameId" element={<ComponentErrorBoundary><GameAnalysisPage /></ComponentErrorBoundary>} />
                  <Route path="/login" element={<ComponentErrorBoundary><PublicOnlyRoute><LoginPage /></PublicOnlyRoute></ComponentErrorBoundary>} />
                  <Route path="/signup" element={<ComponentErrorBoundary><PublicOnlyRoute><SignUpPage /></PublicOnlyRoute></ComponentErrorBoundary>} />
                  <Route path="/forgot-password" element={<ComponentErrorBoundary><ForgotPasswordPage /></ComponentErrorBoundary>} />
                  <Route path="/reset-password" element={<ComponentErrorBoundary><ResetPasswordPage /></ComponentErrorBoundary>} />
                  <Route path="/profile" element={<ComponentErrorBoundary><ProtectedRoute><ProfilePage /></ProtectedRoute></ComponentErrorBoundary>} />
                  <Route path="/pricing" element={<ComponentErrorBoundary><PricingPage /></ComponentErrorBoundary>} />
                  <Route path="/terms" element={<ComponentErrorBoundary><TermsOfServicePage /></ComponentErrorBoundary>} />
                  <Route path="/privacy" element={<ComponentErrorBoundary><PrivacyPolicyPage /></ComponentErrorBoundary>} />
                  <Route path="/coach" element={<ComponentErrorBoundary><CoachDashboardPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/play" element={<ComponentErrorBoundary><PlayWithCoachPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/review" element={<ComponentErrorBoundary><LessonsPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/review/:platform/:userId/:gameId" element={<ComponentErrorBoundary><GameReviewPage /></ComponentErrorBoundary>} />
                  {/* Redirect old lesson URLs */}
                  <Route path="/coach/lessons" element={<Navigate to="/coach/review" replace />} />
                  <Route path="/coach/lessons/:lessonId" element={<Navigate to="/coach/review" replace />} />
                  <Route path="/coach/progress" element={<ComponentErrorBoundary><ProgressPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/positions" element={<ComponentErrorBoundary><PositionLibraryPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/puzzles" element={<ComponentErrorBoundary><PuzzlesPage /></ComponentErrorBoundary>} />
                  <Route path="/coach/puzzles/solve" element={<ComponentErrorBoundary><PuzzleSolvePage /></ComponentErrorBoundary>} />
                  <Route path="*" element={<ComponentErrorBoundary><NotFoundPage /></ComponentErrorBoundary>} />
                </Routes>
              </Suspense>
              <Footer />
            </div>
            <AccountSetupModal />
            <Analytics />
            <SpeedInsights />
          </Router>
        </ChessSoundProvider>
      </AuthProvider>
      </ToastProvider>
    </PageErrorBoundary>
  )
}

export default App
