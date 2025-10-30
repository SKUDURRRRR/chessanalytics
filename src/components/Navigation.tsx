import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Navigation() {
  const { user, signOut, usageStats, loading } = useAuth()
  const location = useLocation()

  const handleSignOut = async () => {
    try {
      await signOut()
      // Redirect to home page after sign out
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out failed:', error)
      // Show error to user - you might want to use a toast notification here
      alert('Failed to sign out. Please try again.')
      // Don't redirect on error to prevent confusion about auth state
    }
  }

  // Generate login/signup links with returnTo query param
  const getAuthUrl = (path: string) => {
    // Don't include returnTo if already on login/signup pages
    if (location.pathname === '/login' || location.pathname === '/signup') {
      return path
    }
    // Include the current path and search params as returnTo
    const fullPath = location.pathname + location.search
    return `${path}?returnTo=${encodeURIComponent(fullPath)}`
  }

  return (
    <nav className="bg-slate-900 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo and App Name */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img
              src="/logo.png"
              alt="ChessData"
              className="h-8 w-auto"
            />
            <span className="text-xl font-semibold text-white">ChessData</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-4">
            {loading ? (
              // Show loading skeleton while auth state is being determined
              <div className="flex items-center gap-3">
                <div className="w-16 h-8 bg-slate-700 rounded animate-pulse"></div>
                <div className="w-16 h-8 bg-slate-700 rounded animate-pulse"></div>
              </div>
            ) : user ? (
              // Authenticated user navigation
              <>
                {/* Usage Stats Indicator */}
                {usageStats && !usageStats.isUnlimited && (
                  <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
                    {usageStats.imports && !usageStats.imports.unlimited && (
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500">Imports</span>
                        <span className={usageStats.imports.remaining === 0 ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                          {usageStats.imports.remaining}/{usageStats.imports.limit}
                        </span>
                      </div>
                    )}
                    {usageStats.analyses && !usageStats.analyses.unlimited && (
                      <div className="flex flex-col items-end">
                        <span className="text-slate-500">Analyses</span>
                        <span className={usageStats.analyses.remaining === 0 ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                          {usageStats.analyses.remaining}/{usageStats.analyses.limit}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <Link
                  to="/pricing"
                  className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Pricing
                </Link>
                <Link
                  to="/profile"
                  className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors text-sm font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              // Anonymous user navigation
              <>
                <Link
                  to="/pricing"
                  className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Pricing
                </Link>
                <Link
                  to={getAuthUrl('/login')}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to={getAuthUrl('/signup')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
