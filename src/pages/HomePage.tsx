// Home Page - Engaging entry point for chess improvement
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlayerSearch } from '../components/simple/PlayerSearch'
import { useAuth } from '../contexts/AuthContext'
import { EloMockup } from '../components/landing/EloMockup'
import { PersonalityMockup } from '../components/landing/PersonalityMockup'
import { ChessboardMockup } from '../components/landing/ChessboardMockup'
import { Check, TrendingUp, Brain, BarChart3 } from 'lucide-react'
import { Button } from '../components/ui'

interface ScreenshotMockupProps {
  children: React.ReactNode
}

// Render mockup content at a fixed comfortable width, then scale down to fit container
const MOCKUP_CONTENT_WIDTH = 660

function ScreenshotMockup({ children }: ScreenshotMockupProps) {
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

  return (
    <div className="relative p-6">
      {/* Browser mockup frame */}
      <div className="relative rounded-lg overflow-hidden bg-surface-1 shadow-card">
        {/* Browser top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-surface-3" />
            <div className="w-2.5 h-2.5 rounded-full bg-surface-3" />
            <div className="w-2.5 h-2.5 rounded-full bg-surface-3" />
          </div>
          <div className="flex-1 mx-3">
            <div className="bg-surface-3 rounded-md px-3 py-1 text-caption text-gray-500 font-mono truncate text-center">
              chessdata.app
            </div>
          </div>
          <div className="w-[52px]" />
        </div>

        {/* Auto-scaled content */}
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
    const currentPath = window.location.pathname
    const hasHash = window.location.hash
    const isWildcard = currentPath === '/*'

    if (hasHash || isWildcard) {
      const cleanPath = isWildcard ? '/' : currentPath
      window.history.replaceState(null, '', cleanPath + window.location.search)
    }

    const returnTo = sessionStorage.getItem('auth_return_to')
    if (user && returnTo && returnTo !== '/') {
      sessionStorage.removeItem('auth_return_to')
      navigate(returnTo)
    }
  }, [user, navigate])

  const handlePlayerSelect = (userId: string, platform: 'lichess' | 'chess.com') => {
    navigate(`/simple-analytics?user=${encodeURIComponent(userId)}&platform=${encodeURIComponent(platform)}`)
  }

  const howItWorksSteps = [
    {
      step: '1',
      icon: <Check size={16} />,
      title: 'Enter Your Username',
      description: 'Type your Chess.com or Lichess username. That\'s all we need.',
      time: '10 seconds',
    },
    {
      step: '2',
      icon: <TrendingUp size={16} />,
      title: 'We Import & Analyze',
      description: 'Stockfish 17.1 runs through your recent games. AI generates commentary for key moves.',
      time: '~2 minutes',
    },
    {
      step: '3',
      icon: <BarChart3 size={16} />,
      title: 'Explore Your Insights',
      description: 'Personality radar, ELO trends, opening analysis, and move-by-move AI commentary — all yours.',
      time: 'Unlimited access',
    }
  ]

  return (
    <div className="relative min-h-screen bg-surface-base text-gray-300">
      {/* Hero */}
      <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-2 sm:pt-12 sm:pb-4 md:pt-16 md:pb-6">
        <header className="text-center">
          <h1 className="text-title sm:text-[2rem] font-semibold leading-tight tracking-heading text-[#f0f0f0]">
            See why you really lost that game
          </h1>
          <p className="mt-4 text-body sm:text-small text-gray-400 max-w-2xl mx-auto">
            Stockfish 17.1 analyzes your Chess.com and Lichess games with move-by-move AI commentary that explains the ideas, not just the numbers.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-small text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="text-gray-400">&#9822;</span>
              Chess.com
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-gray-400">&#9823;</span>
              Lichess
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400/60" />
              No account needed
            </span>
          </div>
        </header>

        {/* Search container */}
        <div className="mt-10 relative">
          <div className="relative rounded-lg overflow-hidden bg-surface-1 shadow-card p-6 sm:p-8">
            <div
              className="h-px -mx-6 sm:-mx-8 mb-6"
              style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)' }}
            />
            <PlayerSearch onPlayerSelect={handlePlayerSelect} />
          </div>
        </div>

        {!user && (
          <div className="mt-6 text-center">
            <p className="text-small text-gray-500 mb-3">
              Want to save your analysis and track progress over time?
            </p>
            <Link to="/signup">
              <Button variant="secondary" size="sm">
                Create Free Account
              </Button>
            </Link>
            <p className="mt-2 text-caption text-gray-600">No credit card required</p>
          </div>
        )}
      </div>

      {/* Core Features Showcase */}
      <section className="max-w-5xl mx-auto px-6 pt-6 pb-12 sm:pt-8 sm:pb-16 md:pt-12 md:pb-20 space-y-16 sm:space-y-20">
        {/* Feature 1: AI Coach Commentary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="label text-amber-300/60 mb-3 flex items-center gap-2">
              <Brain size={14} />
              <span>Your Chess Coach</span>
            </div>
            <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-4">
              Learn from every move
            </h2>
            <ul className="space-y-3 text-body text-gray-400">
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-amber-400/60 mt-0.5 flex-shrink-0" />
                <span>Move-by-move commentary explaining <em className="text-gray-300 not-italic font-medium">why</em>, not just evaluation numbers</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-amber-400/60 mt-0.5 flex-shrink-0" />
                <span>Written in the spirit of Mikhail Tal — passionate and insightful</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-amber-400/60 mt-0.5 flex-shrink-0" />
                <span>Covers principles, patterns, and ideas behind each decision</span>
              </li>
            </ul>
            <div className="mt-6 bg-surface-1 shadow-card rounded-lg p-5">
              <p className="text-small text-amber-200/60 italic leading-relaxed">
                "This move maintains the tension in the center while keeping your pieces
                flexible. The knight can support the pawn push or retreat to safety - options
                that keep your opponent guessing."
              </p>
              <p className="text-caption text-gray-600 mt-2">- TaI Coach</p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <ScreenshotMockup>
              <ChessboardMockup />
            </ScreenshotMockup>
          </div>
        </div>

        {/* Feature 2: Rich Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <ScreenshotMockup>
              <PersonalityMockup />
            </ScreenshotMockup>
          </div>
          <div>
            <div className="label text-gray-400 mb-3 flex items-center gap-2">
              <BarChart3 size={14} />
              <span>Know Your Style</span>
            </div>
            <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-4">
              Discover your chess personality
            </h2>
            <ul className="space-y-3 text-body text-gray-400">
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <span>6-dimension personality radar: tactical, positional, aggressive, patient, novelty, staleness</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <span>See your strengths and exactly where to focus your study</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <span>Opening win rates, style-matched recommendations, and progress over time</span>
              </li>
            </ul>
            <div className="mt-6 bg-surface-1 shadow-card rounded-lg p-5">
              <p className="text-small text-gray-400 leading-relaxed">
                See your playing style visualized: tactical vs positional, aggressive vs patient,
                and how you're improving in each area.
              </p>
            </div>
          </div>
        </div>

        {/* Feature 3: Performance Tracking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="label text-gray-400 mb-3 flex items-center gap-2">
              <TrendingUp size={14} />
              <span>Track Your Progress</span>
            </div>
            <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-4">
              Comprehensive performance tracking
            </h2>
            <ul className="space-y-3 text-body text-gray-400">
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <span>ELO trends over time with win/loss/draw visualization</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <span>Opening performance breakdown — see which openings work for you</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <span>Stats by time control — from bullet to classical</span>
              </li>
            </ul>
            <div className="mt-6 bg-surface-1 shadow-card rounded-lg p-5">
              <p className="text-small text-gray-400 leading-relaxed">
                Track ELO trends, opening performance, time control statistics, win rates,
                and more - all in one comprehensive dashboard.
              </p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <ScreenshotMockup>
              <EloMockup />
            </ScreenshotMockup>
          </div>
        </div>
      </section>

      {/* See It in Action */}
      <section className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-3">
            See it in action
          </h2>
          <p className="text-body text-gray-500 mb-8">
            Click any player to explore their full analysis — no account needed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {[
              { name: 'hikaru', platform: 'chess.com', rating: '~3200', label: 'GM Hikaru Nakamura' },
              { name: 'DrNykterstein', platform: 'lichess', rating: '~2800', label: 'Magnus Carlsen' },
              { name: 'DanielNaroditsky', platform: 'chess.com', rating: '~3000', label: 'GM Daniel Naroditsky' },
            ].map(player => (
              <a
                key={player.name}
                href={`/simple-analytics?user=${player.name}&platform=${player.platform}`}
                className="bg-surface-1 shadow-card rounded-lg p-5 hover:shadow-card-hover transition-colors text-left"
              >
                <div className="text-section font-medium text-[#f0f0f0]">{player.label}</div>
                <div className="text-caption text-gray-500 mt-1">{player.platform} &middot; {player.rating}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 py-12 sm:py-16 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="label text-gray-500 mb-6">Simple Steps</div>
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {howItWorksSteps.map((item) => (
              <div key={item.step} className="bg-surface-1 shadow-card rounded-lg p-5 text-left hover:shadow-card-hover transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-7 h-7 rounded-md bg-white/[0.06] flex items-center justify-center text-small font-medium text-gray-300">
                    {item.step}
                  </div>
                  <div className="text-gray-400">{item.icon}</div>
                </div>
                <h3 className="text-section font-semibold tracking-section text-[#f0f0f0] mb-2">{item.title}</h3>
                <p className="text-small text-gray-500 leading-relaxed">{item.description}</p>
                <div className="mt-3 text-caption text-gray-600">{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What sets us apart */}
      <section className="max-w-5xl mx-auto px-6 py-12 sm:py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] text-center mb-8">
            What sets chessdata.app apart
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-surface-1 shadow-card rounded-lg p-5 text-center">
              <div className="text-stat font-semibold tracking-heading text-[#f0f0f0] mb-2">Stockfish 17.1</div>
              <p className="text-small text-gray-500">
                The same engine used by super-GMs, analyzing your games move by move
              </p>
            </div>
            <div className="bg-surface-1 shadow-card rounded-lg p-5 text-center">
              <div className="text-stat font-semibold tracking-heading text-[#f0f0f0] mb-2">AI Commentary</div>
              <p className="text-small text-gray-500">
                Human-like coaching that explains ideas, not just evaluation numbers
              </p>
            </div>
            <div className="bg-surface-1 shadow-card rounded-lg p-5 text-center">
              <div className="text-stat font-semibold tracking-heading text-[#f0f0f0] mb-2">Cross-Platform</div>
              <p className="text-small text-gray-500">
                Analyze games from both Chess.com and Lichess in one place
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-6 py-12 sm:py-16 md:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-3">
            Ready to understand your games?
          </h2>
          <p className="text-body text-gray-500 mb-8">
            Enter your username above to get started, or create a free account to save your analysis and track progress over time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Search Your Games
            </Button>
            {!user && (
              <Link to="/signup">
                <Button variant="secondary">
                  Create Free Account
                </Button>
              </Link>
            )}
          </div>
          <p className="mt-4 text-caption text-gray-600">No credit card required. Works with Chess.com and Lichess.</p>
        </div>
      </section>
    </div>
  )
}
