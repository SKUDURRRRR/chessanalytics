// Home Page - Engaging entry point for chess improvement
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayerSearch } from '../components/simple/PlayerSearch'
import { useAuth } from '../contexts/AuthContext'

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [imageError, setImageError] = useState(false)
  const [personalityImageError, setPersonalityImageError] = useState(false)
  const [eloImageError, setEloImageError] = useState(false)

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

  const howItWorksSteps = [
    {
      step: '1',
      iconEmoji: '🔍',
      title: 'Search Your Games',
      description: 'Enter your username from Lichess or Chess.com. We will import your recent games and get you started.'
    },
    {
      step: '2',
      iconEmoji: '📈',
      title: 'Analyze & Learn',
      description: 'Explore your analytics, dive into game analysis, and read through AI coach commentary on your moves.'
    },
    {
      step: '3',
      iconEmoji: '🌟',
      title: 'Improve Your Game',
      description: 'Use the insights you discover to focus your study, understand your patterns, and play better chess.'
    }
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="relative container-responsive space-responsive py-8 sm:py-12 md:py-16">
        <header className="text-center">
          <h1 className="text-fluid-4xl font-semibold leading-tight text-white">
            Your edge for improvement
          </h1>
          <p className="mt-4 text-fluid-base"
             style={{ color: '#B0B8C4' }}>
            TaI coach commentary, Stockfish-powered analysis, and personalized insights to improve your game.
          </p>
        </header>

        <div className="mt-12 relative">
          {/* Second layer frame - behind main card */}
          <div className="absolute rounded-[40px] border-2 overflow-hidden"
               style={{
                 top: '-16px',
                 left: '-16px',
                 right: '-16px',
                 bottom: '-16px',
                 width: 'calc(100% + 32px)',
                 height: 'calc(100% + 32px)',
                 borderColor: 'rgba(71, 85, 105, 0.7)',
                 backgroundColor: '#1A202C',
                 zIndex: 0,
               }}></div>

          {/* Container with crisp border */}
          <div className="relative rounded-[32px] border overflow-hidden"
               style={{
                 borderColor: 'rgba(71, 85, 105, 0.6)',
                 zIndex: 1,
                 position: 'relative',
                 boxShadow: `
                   0 0 0 1px rgba(71, 85, 105, 0.15),
                   0 2px 4px 0 rgba(0, 0, 0, 0.05),
                   0 4px 8px -2px rgba(0, 0, 0, 0.1),
                   0 8px 16px -4px rgba(0, 0, 0, 0.15),
                   0 12px 24px -6px rgba(0, 0, 0, 0.2),
                   0 16px 32px -8px rgba(0, 0, 0, 0.25),
                   0 20px 40px -10px rgba(0, 0, 0, 0.3),
                   0 24px 48px -12px rgba(0, 0, 0, 0.35),
                   0 0 120px -40px rgba(56, 189, 248, 0.1)
                 `,
               }}>
            {/* Dark blue-grey base background with gradient */}
            <div className="absolute inset-0"
                 style={{
                   background: 'linear-gradient(135deg, rgba(26, 32, 44, 1) 0%, rgba(20, 30, 45, 1) 50%, rgba(26, 32, 44, 1) 100%)',
                   backdropFilter: 'saturate(180%) contrast(105%)',
                   WebkitBackdropFilter: 'saturate(180%) contrast(105%)',
                 }}></div>

            {/* Content layer - always crisp */}
            <div className="relative p-8 sm:p-10"
                 style={{
                   zIndex: 10,
                   boxShadow: `
                     inset 0 0 0 1px rgba(255, 255, 255, 0.03),
                     inset 0 1px 2px 0 rgba(255, 255, 255, 0.06)
                   `,
                   imageRendering: 'crisp-edges',
                   WebkitFontSmoothing: 'antialiased',
                   MozOsxFontSmoothing: 'grayscale',
                   transform: 'translate3d(0, 0, 0)',
                   WebkitTransform: 'translate3d(0, 0, 0)',
                 }}>
              <PlayerSearch onPlayerSelect={handlePlayerSelect} />
            </div>
          </div>
        </div>
      </div>


      {/* Core Features Showcase */}
      <section className="relative container-responsive py-12 sm:py-16 md:py-20 space-y-16 sm:space-y-20">
        {/* Feature 1: AI Coach Commentary */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5 text-xs uppercase tracking-wide text-amber-200 mb-4">
                <span>♛</span>
                <span>Your Chess Coach</span>
              </div>
              <h2 className="text-fluid-3xl font-semibold text-white mb-4">
                Learn from every move, not just the numbers
              </h2>
              <p className="text-fluid-base text-slate-300 leading-relaxed mb-6">
                Every move in your games gets thoughtful commentary that explains the ideas behind
                the moves. Instead of just seeing "+1.2", "-0.8" or generic AI, you'll understand why a move
                works or doesn't work - the principles, the patterns, the story behind each decision.
              </p>
              <p className="text-fluid-base text-slate-300 leading-relaxed">
                Our coach writes in the spirit of Mikhail Tal - bringing chess to life with
                passion and insight. You'll learn not just what happened, but why it matters
                for your game.
              </p>
              <div className="mt-8 card-responsive bg-amber-500/5 border-amber-400/20">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💬</span>
                  <div>
                    <p className="text-sm text-amber-200 italic leading-relaxed">
                      "This move maintains the tension in the center while keeping your pieces
                      flexible. The knight can support the pawn push or retreat to safety - options
                      that keep your opponent guessing."
                    </p>
                    <p className="text-xs text-slate-400 mt-2">- TaI Coach</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="card-responsive bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-400/20 min-h-64 overflow-hidden relative flex items-center justify-center">
                {imageError ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">♛</div>
                      <p className="text-sm text-slate-400">AI Coach Commentary</p>
                    </div>
                  </div>
                ) : (
                  <img
                    src="/assets/chessboard.png"
                    alt="Chess board with AI coach commentary"
                    className="w-full h-auto max-h-96 object-contain"
                    onError={() => setImageError(true)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: Rich Analytics */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <div className="card-responsive bg-gradient-to-br from-sky-500/10 to-cyan-600/5 border-sky-400/20 min-h-64 overflow-hidden relative flex items-center justify-center">
                {personalityImageError ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📊</div>
                      <p className="text-sm text-slate-400">Personality Radar & Analytics</p>
                    </div>
                  </div>
                ) : (
                  <img
                    src="/assets/Personality.png"
                    alt="Chess personality radar visualization"
                    className="w-full h-auto max-h-96 object-contain"
                    onError={() => setPersonalityImageError(true)}
                  />
                )}
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-1.5 text-xs uppercase tracking-wide text-sky-200 mb-4">
                <span>📊</span>
                <span>Know Your Style</span>
              </div>
              <h2 className="text-fluid-3xl font-semibold text-white mb-4">
                Discover your chess personality
              </h2>
              <p className="text-fluid-base text-slate-300 leading-relaxed mb-6">
                Are you more tactical or positional? Do you prefer aggressive attacks or patient
                consolidation? Your personality radar shows you the patterns in your play,
                helping you understand both your strengths and areas where you can grow.
              </p>
              <p className="text-fluid-base text-slate-300 leading-relaxed">
                Beyond personality, you'll see your ELO trends, opening performance, and time
                control stats - all the insights that help you see your progress over time and
                make smarter study choices.
              </p>
              <div className="mt-8 card-responsive bg-sky-500/5 border-sky-400/20">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <p className="text-sm text-sky-200">
                      See your playing style visualized: tactical vs positional, aggressive vs patient,
                      and how you're improving in each area.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 3: Performance Tracking */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5 text-xs uppercase tracking-wide text-purple-200 mb-4">
                <span>📈</span>
                <span>Track Your Progress</span>
              </div>
              <h2 className="text-fluid-3xl font-semibold text-white mb-4">
                Comprehensive performance tracking that shows your growth
              </h2>
              <p className="text-fluid-base text-slate-300 leading-relaxed mb-6">
                Watch your ELO rating evolve over time with detailed trend analysis. Track your
                performance across different openings to see which ones work best for your style.
                Monitor your results by time control - from bullet to classical - and understand
                where you excel and where you need practice.
              </p>
              <div className="mt-8 card-responsive bg-purple-500/5 border-purple-400/20">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📊</span>
                  <div>
                    <p className="text-sm text-purple-200">
                      Track ELO trends, opening performance, time control statistics, win rates,
                      and more - all in one comprehensive dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="card-responsive bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-400/20 min-h-64 overflow-hidden relative flex items-center justify-center">
                {eloImageError ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">♚</div>
                      <p className="text-sm text-slate-400">Game Analysis</p>
                    </div>
                  </div>
                ) : (
                  <img
                    src="/assets/elo.png"
                    alt="ELO rating and game analysis visualization"
                    className="w-full h-auto max-h-96 object-contain"
                    onError={() => setEloImageError(true)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative container-responsive py-12 sm:py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-wide text-slate-300 shadow-md shadow-cyan-500/10 mb-8">
            <span>Simple Steps</span>
          </div>
          <h2 className="text-fluid-3xl font-semibold text-white mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorksSteps.map((item) => (
              <div key={item.step} className="card-responsive text-left group hover:border-white/20 hover:bg-white/[0.08] transition duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{item.iconEmoji}</div>
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sm font-semibold text-sky-200">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Encouragement Section */}
      <section className="relative container-responsive py-12 sm:py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card-responsive bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-white/10">
            <h2 className="text-fluid-2xl font-semibold text-white mb-4">
              You're not alone in wanting to improve
            </h2>
            <p className="text-fluid-base text-slate-300 leading-relaxed mb-6">
              Chess improvement is a journey that thousands of players are on right now.
              Every game you play, every analysis you review, every pattern you notice - it all adds up.
              The players who improve aren't necessarily the most talented; they're the ones who
              keep learning from their games.
            </p>
            <p className="text-fluid-base text-slate-300 leading-relaxed mb-8">
              We're here to help you see your progress, understand your style, and learn from
              every move.
            </p>
            <a
              href="https://discord.gg/S3ymXCeCqK"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Join our Discord community</span>
            </a>
          </div>
        </div>
      </section>

      {/* Final Call-to-Action */}
      <section className="relative container-responsive py-12 sm:py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="text-fluid-3xl font-semibold text-white mb-6">
            Ready to see what your games can teach you?
          </h2>
          <p className="text-fluid-base text-slate-300 leading-relaxed">
            Start by searching for your profile. No account needed - just enter your username
            and we'll show you what insights are waiting in your games.
          </p>
        </div>

        <div className="relative">
            {/* Second layer frame - behind main card */}
            <div className="absolute rounded-[40px] border-2 overflow-hidden"
                 style={{
                   top: '-16px',
                   left: '-16px',
                   right: '-16px',
                   bottom: '-16px',
                   width: 'calc(100% + 32px)',
                   height: 'calc(100% + 32px)',
                   borderColor: 'rgba(71, 85, 105, 0.7)',
                   backgroundColor: '#1A202C',
                   zIndex: 0,
                 }}></div>

            {/* Container with crisp border */}
            <div className="relative rounded-[32px] border overflow-hidden"
                 style={{
                   borderColor: 'rgba(71, 85, 105, 0.6)',
                   zIndex: 1,
                   position: 'relative',
                   boxShadow: `
                     0 0 0 1px rgba(71, 85, 105, 0.15),
                     0 2px 4px 0 rgba(0, 0, 0, 0.05),
                     0 4px 8px -2px rgba(0, 0, 0, 0.1),
                     0 8px 16px -4px rgba(0, 0, 0, 0.15),
                     0 12px 24px -6px rgba(0, 0, 0, 0.2),
                     0 16px 32px -8px rgba(0, 0, 0, 0.25),
                     0 20px 40px -10px rgba(0, 0, 0, 0.3),
                     0 24px 48px -12px rgba(0, 0, 0, 0.35),
                     0 0 120px -40px rgba(56, 189, 248, 0.1)
                   `,
                 }}>
              {/* Dark blue-grey base background with gradient */}
              <div className="absolute inset-0"
                   style={{
                     background: 'linear-gradient(135deg, rgba(26, 32, 44, 1) 0%, rgba(20, 30, 45, 1) 50%, rgba(26, 32, 44, 1) 100%)',
                     backdropFilter: 'saturate(180%) contrast(105%)',
                     WebkitBackdropFilter: 'saturate(180%) contrast(105%)',
                   }}></div>

              {/* Content layer - always crisp */}
              <div className="relative p-8 sm:p-10"
                   style={{
                     zIndex: 10,
                     boxShadow: `
                       inset 0 0 0 1px rgba(255, 255, 255, 0.03),
                       inset 0 1px 2px 0 rgba(255, 255, 255, 0.06)
                     `,
                     imageRendering: 'crisp-edges',
                     WebkitFontSmoothing: 'antialiased',
                     MozOsxFontSmoothing: 'grayscale',
                     transform: 'translate3d(0, 0, 0)',
                     WebkitTransform: 'translate3d(0, 0, 0)',
                   }}>
                <PlayerSearch onPlayerSelect={handlePlayerSelect} />
              </div>
            </div>
          </div>
      </section>
    </div>
  )
}
