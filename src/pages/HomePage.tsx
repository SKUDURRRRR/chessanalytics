// Home Page - Entry point with player search
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayerSearch } from '../components/simple/PlayerSearch'
import { useAuth } from '../contexts/AuthContext'

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    // Clean up OAuth hash fragments and wildcards from URL
    const currentPath = window.location.pathname
    const hasHash = window.location.hash
    const isWildcard = currentPath === '/*'

    // If there's a hash or wildcard path, clean up the URL
    if (hasHash || isWildcard) {
      // Use clean root path if it's a wildcard, otherwise keep the actual path
      const cleanPath = isWildcard ? '/' : currentPath
      // Remove the hash from URL without reloading the page
      window.history.replaceState(null, '', cleanPath + window.location.search)
    }

    // Check if user just logged in via OAuth and has a return URL
    const returnTo = sessionStorage.getItem('auth_return_to')
    if (user && returnTo && returnTo !== '/') {
      // Clear the stored return URL
      sessionStorage.removeItem('auth_return_to')
      // Redirect to the stored URL
      navigate(returnTo)
    }
  }, [user, navigate])

  const handlePlayerSelect = (userId: string, platform: 'lichess' | 'chess.com') => {
    // Redirect directly to the full user profile page
    window.location.href = `/simple-analytics?user=${userId}&platform=${platform}`
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(14,116,144,0.2),_transparent_40%)]" />
      <div className="relative container-responsive space-responsive py-8 sm:py-12 md:py-16">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wide text-slate-300 shadow-md shadow-cyan-500/10">
            Precision Chess Insights
          </div>
          <h1 className="mt-6 text-fluid-4xl font-semibold leading-tight text-white">
            Understand your moves with chess data
          </h1>
          <p className="mt-4 text-fluid-base text-slate-300">
            Explore match histories, uncover openings that win for you, and run deep Stockfish reviews in a single, streamlined space.
          </p>
        </header>

        <div className="card-responsive">
          <PlayerSearch onPlayerSelect={handlePlayerSelect} />
        </div>

        {/* Feature blocks centered horizontally */}
        <div className="mt-24 mb-16 flex justify-center">
          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl">
            {[{
              title: 'Instant Profiles',
              description: 'Jump directly into head-to-head stats, win streaks, and rating momentum.'
            }, {
              title: 'Engine-Guided Review',
              description: 'Queue Stockfish analysis for any game and see accuracy, blunders, and centipawn swings.'
            }, {
              title: 'Opening Radar',
              description: 'Spot the openings you score best with and filter recent games to focus your study.'
            }].map((card) => (
              <article
                key={card.title}
                className="group relative overflow-hidden card-responsive transition duration-300 hover:border-white/20 hover:bg-white/[0.12]"
              >
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl transition duration-300 group-hover:bg-sky-400/30" />
                <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{card.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-sky-300">
                  Explore
                  <span aria-hidden className="h-px w-6 bg-sky-400/70" />
                </span>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
