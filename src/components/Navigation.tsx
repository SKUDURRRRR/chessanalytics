import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useRef, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

interface LastVisitedPlayer {
  userId: string
  platform: 'lichess' | 'chess.com'
  timestamp: number
}

export function Navigation() {
  const { user, signOut, usageStats, loading } = useAuth()
  const location = useLocation()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [lastVisitedPlayer, setLastVisitedPlayer] = useState<LastVisitedPlayer | null>(null)

  // Derive linked account info for navigation
  const linkedUsername = user?.primaryPlatform === 'chess.com'
    ? user.chessComUsername
    : user?.primaryPlatform === 'lichess'
      ? user.lichessUsername
      : user?.chessComUsername || user?.lichessUsername
  const linkedPlatform = user?.primaryPlatform
    || (user?.chessComUsername ? 'chess.com' : user?.lichessUsername ? 'lichess' : null)
  const hasLinkedAccount = !!(user?.chessComUsername || user?.lichessUsername)

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

  // Load last visited player from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lastVisitedPlayer')
      if (stored) {
        const parsed = JSON.parse(stored) as LastVisitedPlayer
        if (parsed.userId && parsed.platform && ['lichess', 'chess.com'].includes(parsed.platform)) {
          setLastVisitedPlayer(parsed)
        }
      }
    } catch (error) {
      console.error('Failed to load last visited player:', error)
    }
  }, [location.pathname])

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out failed:', error)
      alert('Failed to sign out. Please try again.')
    }
  }

  const getAuthUrl = (path: string) => {
    if (location.pathname === '/login' || location.pathname === '/signup') {
      return path
    }
    const fullPath = location.pathname + location.search
    return `${path}?returnTo=${encodeURIComponent(fullPath)}`
  }

  const isActive = (path: string) => {
    if (path === '/simple-analytics') {
      return location.pathname === '/simple-analytics' || location.pathname.startsWith('/profile/')
    }
    if (path === '/coach') {
      return location.pathname.startsWith('/coach')
    }
    return location.pathname === path
  }

  const navLinkClass = (path: string) =>
    isActive(path)
      ? 'px-3.5 py-1.5 rounded-md text-body font-medium bg-white/[0.06] text-white transition-colors'
      : 'px-3.5 py-1.5 rounded-md text-body font-medium text-gray-500 hover:text-gray-400 hover:bg-white/[0.03] transition-colors'

  return (
    <nav className="sticky top-0 z-30 bg-surface-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="chessdata.app" className="w-7 h-7 rounded-md" />
            <span className="hidden sm:inline text-body font-medium text-gray-300">chessdata.app</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-14 h-7 bg-white/[0.04] rounded-md animate-pulse"></div>
                <div className="w-14 h-7 bg-white/[0.04] rounded-md animate-pulse"></div>
              </div>
            ) : user ? (
              <>
                {/* Usage Stats */}
                {usageStats && !usageStats.isUnlimited && (
                  <div className="hidden md:flex items-center gap-3 mr-3 text-caption text-gray-500">
                    {usageStats.imports && !usageStats.imports.unlimited && (
                      <div className="flex flex-col items-end">
                        <span className="label">Imports</span>
                        <span className={usageStats.imports.remaining === 0 ? 'text-rose-400' : 'text-gray-400'}>
                          {usageStats.imports.remaining}/{usageStats.imports.limit}
                        </span>
                      </div>
                    )}
                    {usageStats.analyses && !usageStats.analyses.unlimited && (
                      <div className="flex flex-col items-end">
                        <span className="label">Analyses</span>
                        <span className={usageStats.analyses.remaining === 0 ? 'text-rose-400' : 'text-gray-400'}>
                          {usageStats.analyses.remaining}/{usageStats.analyses.limit}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile menu */}
                <div className="relative md:hidden" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="p-2 rounded-md text-gray-500 hover:text-gray-400 hover:bg-white/[0.03] transition-colors"
                    aria-label="Menu"
                  >
                    {isDropdownOpen ? <X size={18} /> : <Menu size={18} />}
                  </button>

                  {isDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-surface-1 shadow-modal rounded-lg z-40 overflow-hidden"
                    >
                      <div className="py-1">
                        <Link
                          to="/"
                          className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Home
                        </Link>
                        {hasLinkedAccount && linkedUsername && linkedPlatform ? (
                          <Link
                            to={`/simple-analytics?user=${encodeURIComponent(linkedUsername)}&platform=${encodeURIComponent(linkedPlatform)}`}
                            className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            My Analytics
                          </Link>
                        ) : (
                          <Link
                            to="/profile"
                            className="block px-4 py-2.5 text-body text-amber-300/80 hover:bg-white/[0.04] transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            Connect Account
                          </Link>
                        )}
                        <Link
                          to="/pricing"
                          className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Pricing
                        </Link>
                        <Link
                          to="/coach"
                          className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Coach
                        </Link>
                        <Link
                          to="/profile"
                          className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Profile
                        </Link>
                        <div className="divider my-1" />
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false)
                            handleSignOut()
                          }}
                          className="block w-full text-left px-4 py-2.5 text-body text-rose-300/80 hover:bg-white/[0.04] transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop nav */}
                <div className="hidden md:flex items-center gap-1">
                  <Link to="/" className={navLinkClass('/')}>
                    Home
                  </Link>
                  {hasLinkedAccount && linkedUsername && linkedPlatform ? (
                    <Link
                      to={`/simple-analytics?user=${encodeURIComponent(linkedUsername)}&platform=${encodeURIComponent(linkedPlatform)}`}
                      className={navLinkClass('/simple-analytics')}
                    >
                      Analytics
                    </Link>
                  ) : (
                    <Link
                      to="/profile"
                      className="px-3.5 py-1.5 rounded-md text-body font-medium text-amber-300/80 hover:text-amber-200 hover:bg-white/[0.03] transition-colors"
                    >
                      Connect
                    </Link>
                  )}
                  <Link to="/pricing" className={navLinkClass('/pricing')}>
                    Pricing
                  </Link>
                  <Link to="/coach" className={navLinkClass('/coach')}>
                    Coach
                  </Link>
                  <Link to="/profile" className={navLinkClass('/profile')}>
                    Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="ml-2 px-3.5 py-1.5 rounded-md text-body font-medium text-rose-300/80 hover:text-rose-200 hover:bg-rose-500/10 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Mobile menu (anonymous) */}
                <div className="relative md:hidden" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="p-2 rounded-md text-gray-500 hover:text-gray-400 hover:bg-white/[0.03] transition-colors"
                    aria-label="Menu"
                  >
                    {isDropdownOpen ? <X size={18} /> : <Menu size={18} />}
                  </button>

                  {isDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 bg-surface-1 shadow-modal rounded-lg z-40 overflow-hidden"
                    >
                      <div className="py-1">
                        <Link
                          to="/"
                          className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Home
                        </Link>
                        {lastVisitedPlayer && (
                          <Link
                            to={`/simple-analytics?user=${encodeURIComponent(lastVisitedPlayer.userId)}&platform=${encodeURIComponent(lastVisitedPlayer.platform)}`}
                            className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            Recent Player
                          </Link>
                        )}
                        <Link
                          to="/pricing"
                          className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Pricing
                        </Link>
                        <div className="divider my-1" />
                        <Link
                          to={getAuthUrl('/login')}
                          className="block px-4 py-2.5 text-body text-gray-300 hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Login
                        </Link>
                        <Link
                          to={getAuthUrl('/signup')}
                          className="block px-4 py-2.5 text-body font-medium text-cta hover:bg-white/[0.04] transition-colors"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          Sign Up
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop nav (anonymous) */}
                <div className="hidden md:flex items-center gap-1">
                  <Link to="/" className={navLinkClass('/')}>
                    Home
                  </Link>
                  {lastVisitedPlayer && (
                    <Link
                      to={`/simple-analytics?user=${encodeURIComponent(lastVisitedPlayer.userId)}&platform=${encodeURIComponent(lastVisitedPlayer.platform)}`}
                      className={navLinkClass('/simple-analytics')}
                    >
                      Recent Player
                    </Link>
                  )}
                  <Link to="/pricing" className={navLinkClass('/pricing')}>
                    Pricing
                  </Link>
                  <Link to={getAuthUrl('/login')} className={navLinkClass('/login')}>
                    Login
                  </Link>
                  <Link
                    to={getAuthUrl('/signup')}
                    className="ml-2 px-5 py-1.5 rounded-md text-body font-medium bg-cta text-[#111] shadow-btn-primary hover:bg-cta-hover transition-colors"
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
