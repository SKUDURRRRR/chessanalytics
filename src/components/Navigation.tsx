import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useRef, useEffect } from 'react'

export function Navigation() {
  const { user, signOut, usageStats, loading } = useAuth()
  const location = useLocation()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // Helper function to determine if a nav button is active
  const isActive = (path: string) => {
    return location.pathname === path
  }

  // Get button class based on active state
  const getButtonClass = (path: string) => {
    if (isActive(path)) {
      // Green for active state
      return "rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-6 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
    }
    // Blue for default state
    return "rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30"
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
                  to="/"
                  className={getButtonClass('/')}
                >
                  Home
                </Link>
                <Link
                  to="/pricing"
                  className={getButtonClass('/pricing')}
                >
                  Pricing
                </Link>
                <Link
                  to="/profile"
                  className={getButtonClass('/profile')}
                >
                  Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-2xl border border-rose-400/40 bg-rose-500/20 px-6 py-2.5 text-sm font-semibold text-rose-100 transition hover:border-rose-300/60 hover:bg-rose-500/30"
                >
                  Sign Out
                </button>
              </>
            ) : (
              // Anonymous user navigation
              <>
                {/* Mobile dropdown menu */}
                <div className="relative md:hidden" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10 flex items-center gap-2"
                    aria-label="Menu"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                    <span>Menu</span>
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-700 bg-slate-800 shadow-xl z-50">
                      <div className="py-2">
                        <Link
                          to="/"
                          className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Home
                        </Link>
                        <Link
                          to="/pricing"
                          className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Pricing
                        </Link>
                        <Link
                          to={getAuthUrl('/login')}
                          className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Login
                        </Link>
                        <Link
                          to={getAuthUrl('/signup')}
                          className="block px-4 py-2.5 text-sm text-blue-400 hover:bg-slate-700 transition-colors font-semibold"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Sign Up
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop buttons */}
                <div className="hidden md:flex items-center gap-4">
                  <Link
                    to="/"
                    className={getButtonClass('/')}
                  >
                    Home
                  </Link>
                  <Link
                    to="/pricing"
                    className={getButtonClass('/pricing')}
                  >
                    Pricing
                  </Link>
                  <Link
                    to={getAuthUrl('/login')}
                    className={getButtonClass('/login')}
                  >
                    Login
                  </Link>
                  <Link
                    to={getAuthUrl('/signup')}
                    className={getButtonClass('/signup')}
                  >
                    Sign Up
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
