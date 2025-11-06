// Home Page - Engaging entry point for chess improvement
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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wide text-slate-300 shadow-md shadow-cyan-500/10">
            Precision Chess Insights
          </div>
          <h1 className="mt-6 text-fluid-4xl font-semibold leading-tight text-white">
            Turn every game into a chess lesson
          </h1>
          <p className="mt-4 text-fluid-base"
             style={{ color: '#B0B8C4' }}>
            AI coach commentary, Stockfish-powered analysis, and personalized insights that help you understand your moves and improve your game.
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

      {/* Vision Statement Section */}
      <section className="relative container-responsive py-12 sm:py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <img
              src="/logo.png"
              alt="chessdata.app logo"
              className="h-32 w-auto"
            />
          </div>
          <h2 className="text-fluid-3xl font-semibold text-white mb-6">
            Improving at chess is a journey, not a destination
          </h2>
          <div className="space-y-4">
            <p className="text-fluid-base text-slate-300 leading-relaxed">
              If you're playing between 600 and 1800 ELO, you know that feeling.
              You've learned the rules, you've played hundreds of games, and you're hungry to improve.
              But sometimes it's hard to see the patterns in your play—to know what you're doing well
              and where you're leaving points on the board.
            </p>
            <p className="text-fluid-base text-slate-300 leading-relaxed">
              That's where we come in. Think of this as your chess friend who sits down with you
              after each game, helps you understand what happened, and celebrates your progress.
              No judgment, no pressure—just honest insights that help you grow.
            </p>
          </div>
        </div>
      </section>

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
                works or doesn't work—the principles, the patterns, the story behind each decision.
              </p>
              <p className="text-fluid-base text-slate-300 leading-relaxed">
                Our coach writes in the spirit of Mikhail Tal—bringing chess to life with
                passion and insight. You'll learn not just what happened, but why it matters
                for your game.
              </p>
              <div className="mt-8 card-responsive bg-amber-500/5 border-amber-400/20">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💬</span>
                  <div>
                    <p className="text-sm text-amber-200 italic leading-relaxed">
                      "This move maintains the tension in the center while keeping your pieces
                      flexible. The knight can support the pawn push or retreat to safety—options
                      that keep your opponent guessing."
                    </p>
                    <p className="text-xs text-slate-400 mt-2">— TaI Coach</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="card-responsive bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-400/20 h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">♛</div>
                  <p className="text-sm text-slate-400">AI Coach Commentary</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: Rich Analytics */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <div className="card-responsive bg-gradient-to-br from-sky-500/10 to-cyan-600/5 border-sky-400/20 h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-sm text-slate-400">Personality Radar & Analytics</p>
                </div>
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
                control stats—all the insights that help you see your progress over time and
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

        {/* Feature 3: Deep Game Analysis */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5 text-xs uppercase tracking-wide text-purple-200 mb-4">
                <span>♚</span>
                <span>Learn From Every Game</span>
              </div>
              <h2 className="text-fluid-3xl font-semibold text-white mb-4">
                Move-by-move insights that teach principles
              </h2>
              <p className="text-fluid-base text-slate-300 leading-relaxed mb-6">
                Every game you play is a lesson waiting to be learned. Our deep game analysis
                walks you through each move, explaining what worked, what didn't, and what
                principles you can carry into your next game.
              </p>
              <p className="text-fluid-base text-slate-300 leading-relaxed">
                You'll see the critical moments, understand the turning points, and learn
                from both your brilliant moves and your mistakes. It's guided study that fits
                into your schedule—learn from one game, and you'll see patterns in the next.
              </p>
              <div className="mt-8 card-responsive bg-purple-500/5 border-purple-400/20">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <p className="text-sm text-purple-200">
                      Identify key moments, understand why positions changed, and learn principles
                      you can apply in similar situations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="card-responsive bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-400/20 h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">♚</div>
                  <p className="text-sm text-slate-400">Game Analysis</p>
                </div>
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
            <div className="text-5xl mb-6">💪</div>
            <h2 className="text-fluid-2xl font-semibold text-white mb-4">
              You're not alone in wanting to improve
            </h2>
            <p className="text-fluid-base text-slate-300 leading-relaxed mb-6">
              Chess improvement is a journey that thousands of players are on right now.
              Every game you play, every analysis you review, every pattern you notice—it all adds up.
              The players who improve aren't necessarily the most talented; they're the ones who
              keep learning from their games.
            </p>
            <p className="text-fluid-base text-slate-300 leading-relaxed">
              We're here to help you see your progress, understand your style, and learn from
              every move. Let's make your next game better than your last one.
            </p>
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
            Start by searching for your profile. No account needed—just enter your username
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

        <div className="max-w-3xl mx-auto text-center">
          <p className="mt-8 text-sm text-slate-400">
            Perfect for players rated 600-1800 ELO. Start improving today. ♟
          </p>
        </div>
      </section>
    </div>
  )
}
