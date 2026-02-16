// Home Page - Engaging entry point for chess improvement
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayerSearch } from '../components/simple/PlayerSearch'
import { useAuth } from '../contexts/AuthContext'
import { EloMockup } from '../components/landing/EloMockup'
import { PersonalityMockup } from '../components/landing/PersonalityMockup'
import { ChessboardMockup } from '../components/landing/ChessboardMockup'

interface ScreenshotMockupProps {
  glowColor: string
  children: React.ReactNode
}

// Render mockup content at a fixed comfortable width, then scale down to fit container
const MOCKUP_CONTENT_WIDTH = 660

function ScreenshotMockup({ glowColor, children }: ScreenshotMockupProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    const update = () => {
      const containerW = container.offsetWidth
      const s = Math.min(1, containerW / MOCKUP_CONTENT_WIDTH)
      setScale(s)
      setScaledHeight(content.offsetHeight * s)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const glowColors: Record<string, string> = {
    amber: 'from-amber-500/20 via-amber-400/10 to-orange-500/20',
    sky: 'from-sky-500/20 via-cyan-400/10 to-blue-500/20',
    purple: 'from-purple-500/20 via-violet-400/10 to-fuchsia-500/20',
  }

  return (
    <div className="relative group p-6">
      {/* Glow effect behind the frame */}
      <div className={`absolute inset-2 bg-gradient-to-r ${glowColors[glowColor]} rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500`} />

      {/* Browser mockup frame */}
      <div
        className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-slate-900/80"
        style={{
          boxShadow: `
            0 0 0 1px rgba(255, 255, 255, 0.05),
            0 4px 6px -1px rgba(0, 0, 0, 0.3),
            0 10px 15px -3px rgba(0, 0, 0, 0.3),
            0 20px 25px -5px rgba(0, 0, 0, 0.25),
            0 25px 50px -12px rgba(0, 0, 0, 0.5)
          `,
        }}
      >
        {/* Browser top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 mx-3">
            <div className="bg-slate-700/40 rounded-md px-3 py-1 text-[11px] text-slate-500 font-mono truncate text-center">
              chessdata.app
            </div>
          </div>
          <div className="w-[52px]" />
        </div>

        {/* Auto-scaled content: renders at fixed width, scales to fit */}
        <div ref={containerRef} className="overflow-hidden" style={{ height: scaledHeight }}>
          <div
            ref={contentRef}
            style={{
              width: MOCKUP_CONTENT_WIDTH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

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
      title: 'Enter Your Username',
      description: 'Type your Chess.com or Lichess username. That\'s all we need.',
      time: '10 seconds',
    },
    {
      step: '2',
      iconEmoji: '📈',
      title: 'We Import & Analyze',
      description: 'Stockfish 17.1 runs through your recent games. AI generates commentary for key moves.',
      time: '~2 minutes',
    },
    {
      step: '3',
      iconEmoji: '🌟',
      title: 'Explore Your Insights',
      description: 'Personality radar, ELO trends, opening analysis, and move-by-move AI commentary — all yours.',
      time: 'Unlimited access',
    }
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="relative container-responsive pt-8 pb-2 sm:pt-12 sm:pb-4 md:pt-16 md:pb-6">
        <header className="text-center">
          <h1 className="text-fluid-4xl font-semibold leading-tight text-white">
            See why you really lost that game
          </h1>
          <p className="mt-4 text-fluid-base"
             style={{ color: '#B0B8C4' }}>
            Stockfish 17.1 analyzes your Chess.com and Lichess games with move-by-move AI commentary that explains the ideas, not just the numbers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <span className="text-green-400 font-bold">&#9822;</span>
              Works with Chess.com
            </span>
            <span className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold">&#9823;</span>
              Works with Lichess
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              No account needed to start
            </span>
          </div>
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

        {!user && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400 mb-3">
              Want to save your analysis and track progress over time?
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-6 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20"
            >
              Create Free Account
            </Link>
            <p className="mt-2 text-xs text-slate-500">No credit card required</p>
          </div>
        )}
      </div>


      {/* Core Features Showcase */}
      <section className="relative container-responsive pt-6 pb-12 sm:pt-8 sm:pb-16 md:pt-12 md:pb-20 space-y-16 sm:space-y-20 overflow-hidden">
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
              <ul className="space-y-3 text-slate-300 text-fluid-base">
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>Move-by-move commentary explaining <em className="text-white not-italic font-medium">why</em>, not just evaluation numbers</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>Written in the spirit of Mikhail Tal — passionate and insightful</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>Covers principles, patterns, and ideas behind each decision</span>
                </li>
              </ul>
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
              <ScreenshotMockup glowColor="amber">
                <ChessboardMockup />
              </ScreenshotMockup>
            </div>
          </div>
        </div>

        {/* Feature 2: Rich Analytics */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <ScreenshotMockup glowColor="sky">
                <PersonalityMockup />
              </ScreenshotMockup>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-1.5 text-xs uppercase tracking-wide text-sky-200 mb-4">
                <span>📊</span>
                <span>Know Your Style</span>
              </div>
              <h2 className="text-fluid-3xl font-semibold text-white mb-4">
                Discover your chess personality
              </h2>
              <ul className="space-y-3 text-slate-300 text-fluid-base">
                <li className="flex items-start gap-2.5">
                  <span className="text-sky-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>6-dimension personality radar: tactical, positional, aggressive, patient, novelty, staleness</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-sky-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>See your strengths and exactly where to focus your study</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-sky-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>Opening win rates, style-matched recommendations, and progress over time</span>
                </li>
              </ul>
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
              <ul className="space-y-3 text-slate-300 text-fluid-base">
                <li className="flex items-start gap-2.5">
                  <span className="text-purple-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>ELO trends over time with win/loss/draw visualization</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-purple-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>Opening performance breakdown — see which openings work for you</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-purple-400 mt-0.5 flex-shrink-0">&#10003;</span>
                  <span>Stats by time control — from bullet to classical</span>
                </li>
              </ul>
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
              <ScreenshotMockup glowColor="purple">
                <EloMockup />
              </ScreenshotMockup>
            </div>
          </div>
        </div>
      </section>

      {/* See It in Action - Demo Section */}
      <section className="relative container-responsive py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-fluid-2xl font-semibold text-white mb-4">
            See it in action
          </h2>
          <p className="text-slate-400 mb-8">
            Click any player to explore their full analysis — no account needed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              { name: 'hikaru', platform: 'chess.com', rating: '~3200', label: 'GM Hikaru Nakamura' },
              { name: 'DrNykterstein', platform: 'lichess', rating: '~2800', label: 'Magnus Carlsen' },
              { name: 'DanielNaroditsky', platform: 'chess.com', rating: '~3000', label: 'GM Daniel Naroditsky' },
            ].map(player => (
              <a
                key={player.name}
                href={`/simple-analytics?user=${player.name}&platform=${player.platform}`}
                className="card-responsive hover:border-white/20 hover:bg-white/[0.08] transition duration-300 text-left"
              >
                <div className="font-semibold text-white">{player.label}</div>
                <div className="text-xs text-slate-400 mt-1">{player.platform} &middot; {player.rating}</div>
              </a>
            ))}
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
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sm font-semibold text-sky-200">
                    {item.step}
                  </div>
                  <div className="text-3xl">{item.iconEmoji}</div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{item.description}</p>
                <div className="mt-3 inline-flex items-center rounded-full bg-sky-500/10 border border-sky-400/20 px-3 py-1 text-xs font-medium text-sky-300">
                  {item.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Credibility Section */}
      <section className="relative container-responsive py-12 sm:py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-fluid-2xl font-semibold text-white text-center mb-10">
            What sets chessdata.app apart
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card-responsive text-center">
              <div className="text-3xl font-bold text-sky-400 mb-2">Stockfish 17.1</div>
              <p className="text-sm text-slate-400">
                The same engine used by super-GMs, analyzing your games move by move
              </p>
            </div>
            <div className="card-responsive text-center">
              <div className="text-3xl font-bold text-amber-400 mb-2">AI Commentary</div>
              <p className="text-sm text-slate-400">
                Human-like coaching that explains ideas, not just evaluation numbers
              </p>
            </div>
            <div className="card-responsive text-center">
              <div className="text-3xl font-bold text-emerald-400 mb-2">Cross-Platform</div>
              <p className="text-sm text-slate-400">
                Analyze games from both Chess.com and Lichess in one place
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call-to-Action */}
      <section className="relative container-responsive py-12 sm:py-16 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-fluid-3xl font-semibold text-white mb-4">
            Ready to understand your games?
          </h2>
          <p className="text-slate-300 mb-8">
            Enter your username above to get started, or create a free account to save your analysis and track progress over time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="rounded-full border border-sky-400/40 bg-sky-500/20 px-8 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30"
            >
              Search Your Games
            </button>
            {!user && (
              <Link
                to="/signup"
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-8 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-500/20"
              >
                Create Free Account
              </Link>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500">No credit card required. Works with Chess.com and Lichess.</p>
        </div>
      </section>
    </div>
  )
}
