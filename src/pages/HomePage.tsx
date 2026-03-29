// Home Page - Engaging entry point for chess improvement
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayerSearch } from '../components/simple/PlayerSearch'
import { useAuth } from '../contexts/AuthContext'
import { EloMockup } from '../components/landing/EloMockup'
import { PersonalityMockup } from '../components/landing/PersonalityMockup'
import { CoachChatMockup } from '../components/landing/CoachChatMockup'
import { Check, TrendingUp, Brain, BarChart3, MessageCircle } from 'lucide-react'
import { Button } from '../components/ui'

interface ScreenshotMockupProps {
  children: React.ReactNode
  contentWidth?: number
}

const DEFAULT_MOCKUP_WIDTH = 800

function ScreenshotMockup({ children, contentWidth = DEFAULT_MOCKUP_WIDTH }: ScreenshotMockupProps) {
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
      const s = Math.min(1, containerW / contentWidth)
      setScale(s)
      setScaledHeight(content.offsetHeight * s)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [contentWidth])

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: contentWidth }}>
      <div className="relative w-full rounded-lg overflow-hidden bg-surface-1 shadow-card">
        {/* Browser top bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-surface-3" />
            <div className="w-2 h-2 rounded-full bg-surface-3" />
            <div className="w-2 h-2 rounded-full bg-surface-3" />
          </div>
          <div className="flex-1 mx-8">
            <div className="bg-surface-3 rounded px-3 py-0.5 text-caption text-gray-500 font-mono truncate text-center">
              chessdata.app
            </div>
          </div>
          <div className="w-10" />
        </div>

        {/* Auto-scaled content */}
        <div ref={containerRef} className="overflow-hidden w-full" style={{ height: scaledHeight }}>
          <div
            ref={contentRef}
            style={{
              width: contentWidth,
              maxWidth: contentWidth,
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

const features = [
  {
    icon: '\u2655', // chess queen
    title: 'Game Analysis',
    description: 'Stockfish-powered move-by-move analysis with AI coaching comments on your critical positions.',
  },
  {
    icon: '\u2605', // star
    title: 'Deep Insights',
    description: 'Personality profiling, opening repertoire analysis, and long-term improvement tracking across thousands of games.',
  },
  {
    icon: '\u265F', // chess pawn
    title: 'AI Coach',
    description: 'Personalized lessons, targeted puzzles, and training plans tailored to your specific weaknesses.',
  },
]

const secondaryFeatures = [
  {
    icon: '\u21C4', // arrows
    title: 'Auto Import',
    description: 'Connect your Chess.com or Lichess account. Games import automatically \u2014 no PGN uploads needed.',
  },
  {
    icon: '\u25C6', // diamond
    title: 'Game Review',
    description: 'Think First mode challenges you to find the best move before revealing the engine\'s answer.',
  },
  {
    icon: null,
    title: 'Talk with Coach',
    description: 'Chat with an AI coach who answers your chess questions, explains concepts, and gives personalized advice.',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const searchRef = useRef<HTMLDivElement>(null)

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

  const scrollToSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="relative min-h-screen bg-surface-base text-gray-300">
      {/* ===== Hero + Search ===== */}
      <div ref={searchRef} className="px-6 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center max-w-2xl mx-auto">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 bg-surface-1 shadow-card"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-caption text-gray-400">Now with AI coaching powered by Claude & Gemini</span>
        </div>

        <h1 className="text-title sm:text-[2rem] md:text-[2.5rem] font-semibold text-[#f0f0f0] tracking-heading leading-[1.1] mb-5">
          Understand your chess.
        </h1>

        <p className="text-gray-400 text-body leading-relaxed mb-10 max-w-lg mx-auto">
          AI-powered analysis that tells you why you lose - and exactly how to improve.
        </p>

        {/* Inline search */}
        <div className="max-w-xl mx-auto">
          <PlayerSearch onPlayerSelect={handlePlayerSelect} />
        </div>
      </div>

      {/* ===== Social proof bar ===== */}
      <div
        className="px-6 py-5 flex flex-wrap items-center justify-center gap-x-12 gap-y-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="text-center">
          <p className="text-section font-semibold text-white tracking-heading">12,400+</p>
          <p className="text-caption text-gray-400">Games analyzed</p>
        </div>
        <div className="hidden sm:block w-px h-8 bg-white/[0.10]" />
        <div className="text-center">
          <p className="text-section font-semibold text-white tracking-heading">2,100+</p>
          <p className="text-caption text-gray-400">Players</p>
        </div>
        <div className="hidden sm:block w-px h-8 bg-white/[0.10]" />
        <div className="text-center">
          <p className="text-section font-semibold text-white tracking-heading">Chess.com &amp; Lichess</p>
          <p className="text-caption text-gray-400">Supported platforms</p>
        </div>
      </div>

      {/* ===== Features section ===== */}
      <div className="px-6 py-16 sm:py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="label text-gray-500 mb-3">Features</div>
            <h2 className="text-title font-semibold text-[#f0f0f0] tracking-heading">Everything you need to improve</h2>
          </div>

          {/* Primary feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title} className="bg-surface-1 shadow-card rounded-lg overflow-hidden">
                <div
                  className="h-px"
                  style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)' }}
                />
                <div className="p-6">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 bg-white/[0.06]">
                    <span className="text-gray-300 text-sm">{f.icon}</span>
                  </div>
                  <h3 className="text-body font-semibold text-[#f0f0f0] mb-2 tracking-section">{f.title}</h3>
                  <p className="text-small text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Secondary feature cards - same 3-col grid as primary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            {secondaryFeatures.map((f) => (
              <div key={f.title} className="bg-surface-1 shadow-card rounded-lg overflow-hidden" style={{ minHeight: 160 }}>
                <div
                  className="h-px"
                  style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)' }}
                />
                <div className="p-6">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 bg-white/[0.06]">
                    {f.icon ? (
                      <span className="text-gray-300 text-sm">{f.icon}</span>
                    ) : (
                      <MessageCircle className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <h3 className="text-body font-semibold text-[#f0f0f0] mb-2 tracking-section">{f.title}</h3>
                  <p className="text-small text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Feature showcase 1: AI Coach Chat ===== */}
      <div
        className="bg-surface-1 overflow-hidden"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Section header */}
        <div className="px-6 pt-12 pb-6 text-center">
          <div className="label text-amber-300/60 mb-3 flex items-center justify-center gap-2">
            <Brain size={14} />
            <span>Your Chess Coach</span>
          </div>
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-2">
            Learn from every move
          </h2>
          <p className="text-body text-gray-500 max-w-md mx-auto">
            AI-powered commentary and a personal coach you can chat with about any position.
          </p>
        </div>

        {/* Full-width screenshot */}
        <div className="px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            <ScreenshotMockup>
              <CoachChatMockup />
            </ScreenshotMockup>
          </div>
        </div>

        {/* Info strip */}
        <div
          className="h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)' }}
        />
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-amber-400/60 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">Ask questions about any position - get strategic advice and tactical hints</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-amber-400/60 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">Written in the spirit of Mikhail Tal - passionate and insightful coaching</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-amber-400/60 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">Powered by Claude and Gemini with move-by-move AI commentary</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Feature showcase 2: Personality ===== */}
      <div
        className="overflow-hidden"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Section header */}
        <div className="px-6 pt-12 pb-6 text-center">
          <div className="label text-gray-400 mb-3 flex items-center justify-center gap-2">
            <BarChart3 size={14} />
            <span>Know Your Style</span>
          </div>
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-2">
            Discover your chess personality
          </h2>
          <p className="text-body text-gray-500 max-w-md mx-auto">
            See your playing style visualized and find exactly where to focus your study.
          </p>
        </div>

        {/* Full-width screenshot */}
        <div className="px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            <ScreenshotMockup>
              <PersonalityMockup />
            </ScreenshotMockup>
          </div>
        </div>

        {/* Info strip */}
        <div
          className="h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)' }}
        />
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">6-dimension personality radar: tactical, positional, aggressive, patient</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">See your strengths and exactly where to focus your study</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">Opening win rates, style-matched recommendations, and progress over time</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Feature showcase 3: Performance ===== */}
      <div
        className="bg-surface-1 overflow-hidden"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Section header */}
        <div className="px-6 pt-12 pb-6 text-center">
          <div className="label text-gray-400 mb-3 flex items-center justify-center gap-2">
            <TrendingUp size={14} />
            <span>Track Your Progress</span>
          </div>
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-2">
            Comprehensive performance tracking
          </h2>
          <p className="text-body text-gray-500 max-w-md mx-auto">
            Track ELO trends, opening performance, and time control statistics - all in one dashboard.
          </p>
        </div>

        {/* Full-width screenshot */}
        <div className="px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            <ScreenshotMockup>
              <EloMockup />
            </ScreenshotMockup>
          </div>
        </div>

        {/* Info strip */}
        <div
          className="h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)' }}
        />
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">ELO trends over time with win/loss/draw visualization</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">Opening performance breakdown - see which openings work for you</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Check size={14} className="text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="text-small text-gray-400 leading-relaxed">Stats by time control - from bullet to classical</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Testimonial ===== */}
      <div className="px-6 py-12" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-surface-1 shadow-card rounded-lg relative" style={{ padding: '32px 40px' }}>
            <div
              className="absolute text-white/[0.08]"
              style={{ top: 16, left: 24, fontSize: 48, lineHeight: 1, fontFamily: 'Georgia, serif' }}
            >
              &ldquo;
            </div>
            <div className="text-center pt-3">
              <p className="text-body text-gray-300 leading-relaxed italic mb-4">
                &ldquo;I went from 1042 to 1411 in two months. The coaching comments on my blunders were more useful than hours of YouTube tutorials.&rdquo;
              </p>
              <p className="text-small text-gray-500">&ndash; skudurrrrr, Chess.com rapid player</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== See It in Action ===== */}
      <section className="px-6 py-12 sm:py-16" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-3">
            See it in action
          </h2>
          <p className="text-body text-gray-500 mb-8">
            Click any player to explore their full analysis - no account needed.
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
                className="bg-surface-1 shadow-card rounded-lg p-5 hover:shadow-card-hover hover:bg-white/[0.04] cursor-pointer transition-colors text-left"
              >
                <div className="text-section font-medium text-[#f0f0f0]">{player.label}</div>
                <div className="text-caption text-gray-500 mt-1">{player.platform} &middot; {player.rating}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <div
        className="px-6 py-16 bg-surface-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-title font-semibold text-[#f0f0f0] tracking-heading mb-3">
            Ready to improve?
          </h2>
          <p className="text-body text-gray-500 mb-6">
            Free tier includes 5 game analyses per day. No credit card required.
          </p>
          <Button variant="primary" onClick={scrollToSearch} className="px-8 py-2.5 text-sm">
            Start Analyzing
          </Button>
        </div>
      </div>

      {/* Footer rendered globally by App.tsx <Footer /> component */}
    </div>
  )
}
