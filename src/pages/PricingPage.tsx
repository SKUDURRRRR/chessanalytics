import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import config from '../lib/config'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'
import { Check, Shield, Zap, Brain, TrendingUp, BarChart3, Sparkles } from 'lucide-react'

interface PaymentTier {
  id: string
  name: string
  description: string
  price_monthly: number | null
  price_yearly: number | null
  import_limit: number | null
  analysis_limit: number | null
  features: string[]
}

// Fallback pricing tiers shown when backend is unreachable
const FALLBACK_TIERS: PaymentTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out chess analytics',
    price_monthly: 0,
    price_yearly: 0,
    import_limit: 100,
    analysis_limit: 5,
    features: [
      '5 game analyses per day',
      '100 game imports per day',
      'Basic analytics',
      '1 coach lesson per week',
      '3 coach puzzles per day',
    ],
  },
  {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    description: 'Unlimited access to all chess analytics features',
    price_monthly: 5.45,
    price_yearly: null,
    import_limit: null,
    analysis_limit: null,
    features: [
      'Unlimited game imports',
      'Unlimited game analyses',
      'New Games Auto Import',
      'Advanced chess analytics',
      'Deep analysis with Stockfish',
      'Opening repertoire analysis',
      'Personality insights',
      'Position exploration',
      'Tal inspired comments',
      'Playstyle analysis',
      'Learning suggestions',
    ],
  },
  {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    description: 'Save 25% with annual billing',
    price_monthly: null,
    price_yearly: 49.05,
    import_limit: null,
    analysis_limit: null,
    features: [
      'Unlimited game imports',
      'Unlimited game analyses',
      'New Games Auto Import',
      'Advanced chess analytics',
      'Deep analysis with Stockfish',
      'Opening repertoire analysis',
      'All Pro Monthly features',
    ],
  },
]

export default function PricingPage() {
  const { user, usageStats } = useAuth()
  const [tiers, setTiers] = useState<PaymentTier[]>([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' } | null>(null)

  const currentTier = usageStats?.account_tier || 'free'

  useEffect(() => {
    fetchTiers()
  }, [])

  const fetchTiers = async () => {
    try {
      const API_URL = config.getApi().baseUrl

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/payment-tiers`,
        {},
        TIMEOUT_CONFIG.DEFAULT
      )

      logger.log('📡 Response status:', response.status)
      logger.log('📡 Response ok:', response.ok)

      if (response.ok) {
        const data = await response.json()
        logger.log('📦 Data received:', data)
        logger.log('📦 Tiers count:', data.tiers?.length || 0)
        setTiers(data.tiers || [])
        logger.log('Pricing tiers fetched successfully')
      } else {
        const errorText = await response.text()
        logger.error('❌ API Error Response:', errorText)
        logger.warn('Failed to fetch pricing tiers:', response.status)
        setTiers(FALLBACK_TIERS)
      }
    } catch (error) {
      logger.error('❌ Fetch error:', error)
      logger.error('Error fetching tiers, using fallback:', error)
      setTiers(FALLBACK_TIERS)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (amount: number | null) => {
    if (amount === null) return 'Contact us'
    return `$${amount.toFixed(2)}`
  }

  const getButtonText = (tierId: string) => {
    if (tierId === currentTier) {
      return 'Current Plan'
    }
    if (tierId === 'pro_yearly') {
      return 'Upgrade to Yearly'
    }
    if (tierId === 'pro_monthly') {
      return 'Upgrade to Pro Monthly'
    }
    return 'Become Pro'
  }

  const shouldShowButton = (tierId: string) => {
    // Always show button for non-authenticated users
    if (!user) {
      return true
    }

    // Don't show button if it's the current plan
    if (tierId === currentTier) {
      return false
    }

    // Show button for all other cases (upgrades, downgrades, switches)
    return true
  }

  const handleUpgrade = async (tierId: string) => {
    // Input validation
    if (!tierId || typeof tierId !== 'string') {
      logger.error('Invalid tierId provided to handleUpgrade')
      setNotification({ message: 'Invalid tier selection', type: 'error' })
      return
    }

    if (!user) {
      logger.log('Unauthenticated user attempting upgrade, redirecting to signup')
      window.location.href = '/signup'
      return
    }

    setUpgrading(tierId)
    try {
      const API_URL = config.getApi().baseUrl

      // Get the auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        logger.warn('No session found when attempting upgrade')
        setNotification({ message: 'Please log in to upgrade', type: 'error' })
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
        return
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/payments/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            tier_id: tierId,
            success_url: `${window.location.origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/pricing?canceled=true`
          })
        },
        TIMEOUT_CONFIG.LONG
      )

      if (!response.ok) {
        const error = await response.json()
        logger.error('Checkout error:', error)
        const errorMessage =
          typeof error.message === 'string'
            ? error.message
            : typeof error.detail === 'string'
            ? error.detail
            : 'Unknown error'
        setNotification({
          message: `Failed to create checkout session: ${errorMessage}`,
          type: 'error'
        })
        return
      }

      const data = await response.json()

      if (data.url) {
        // Redirect to Stripe Checkout
        logger.log(`Redirecting to Stripe checkout for tier: ${tierId}`)
        window.location.href = data.url
      } else {
        logger.error('No checkout URL received from API')
        setNotification({ message: 'Failed to get checkout URL', type: 'error' })
      }
    } catch (error) {
      logger.error('Error creating checkout:', error)
      setNotification({ message: 'Failed to start checkout. Please try again.', type: 'error' })
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-gray-500">Loading pricing...</div>
      </div>
    )
  }

  // Group features by category for better presentation
  const categorizeFeatures = (features: string[]) => {
    const categories: { [key: string]: string[] } = {
      analysis: [],
      insights: [],
      personalization: [],
      other: []
    }

    features.forEach(feature => {
      const lower = feature.toLowerCase()
      // Only deep analysis and Stockfish go to analysis category
      if (lower.includes('stockfish') || lower.includes('deep analysis')) {
        categories.analysis.push(feature)
      } else if (lower.includes('personality') || lower.includes('opening') || lower.includes('repertoire') || lower.includes('unlimited') || lower.includes('import') || lower.includes('limit') || lower.includes('analytics') || lower.includes('analyses') || lower.includes('tracking') || lower.includes('position exploration') || lower.includes('tal inspired') || lower.includes('playstyle') || lower.includes('learning suggestions') || lower.includes('all pro') || lower.includes('coach') || lower.includes('basic')) {
        categories.insights.push(feature)
      } else {
        categories.other.push(feature)
      }
    })

    return categories
  }

  return (
    <div className="relative min-h-screen bg-surface-base overflow-hidden">
      <div className="relative px-8 py-10">
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full shadow-card bg-white/[0.04] px-4 py-1.5 text-caption uppercase tracking-label text-gray-400 mb-6">
              <Sparkles size={14} className="text-gray-400" />
              <span>Professional Chess Analysis</span>
            </div>
            <h1 className="text-title sm:text-[2rem] font-semibold text-[#f0f0f0] mb-4 tracking-heading leading-tight">
              Transform Your Chess Game
            </h1>
            <p className="text-body text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              Powered by Stockfish 17.1 — understand your mistakes, discover your playing style, and improve faster.
            </p>
          </div>

          {notification && (
            <div className={`max-w-2xl mx-auto mb-8 flex items-center justify-between rounded-md shadow-card px-4 py-3 text-small ${notification.type === 'error' ? 'bg-rose-500/10 text-rose-300/80' : 'bg-emerald-500/10 text-emerald-300/80'}`}>
              <span className="flex-1">{notification.message}</span>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="ml-3 text-caption font-medium text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
              >
                OK
              </button>
            </div>
          )}

          {/* Use Case Scenarios */}
          <div className="mb-10">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-surface-1 shadow-card rounded-lg p-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(228,232,237,0.06)' }}>
                  <TrendingUp size={18} className="text-gray-300" />
                </div>
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">Improving Player</h3>
                <p className="text-gray-500 text-small leading-relaxed">
                  Identify patterns in your play, discover your weaknesses, and track improvement over time.
                </p>
              </div>
              <div className="bg-surface-1 shadow-card rounded-lg p-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(228,232,237,0.06)' }}>
                  <Brain size={18} className="text-gray-300" />
                </div>
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">Coaches &amp; Instructors</h3>
                <p className="text-gray-500 text-small leading-relaxed">
                  Analyze your students' games efficiently. Get detailed insights to guide training.
                </p>
              </div>
              <div className="bg-surface-1 shadow-card rounded-lg p-6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(228,232,237,0.06)' }}>
                  <BarChart3 size={18} className="text-gray-300" />
                </div>
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">Clubs &amp; Teams</h3>
                <p className="text-gray-500 text-small leading-relaxed">
                  Review tournament games, analyze team performance, and prepare for competitions.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:[grid-template-columns:1fr_1.15fr_1fr] gap-3 mb-10">
            {tiers.map((tier) => {
              const isPopular = tier.id === 'pro_monthly'
              const featureCategories = categorizeFeatures(tier.features)
              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-lg transition-colors ${
                    isPopular
                      ? 'bg-[#181a1e]'
                      : 'bg-surface-1 shadow-card'
                  }`}
                  style={isPopular ? { boxShadow: '0 0 0 1px rgba(228,232,237,0.18), 0 0 40px rgba(180,195,215,0.04)' } : undefined}
                >
                  {isPopular && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-[#e4e8ed] text-[#0c0d0f] text-[10px] font-semibold uppercase tracking-wider px-3.5 py-1 rounded-b-lg">
                      Most Popular
                    </div>
                  )}

                  <div className={`p-6 flex flex-col flex-grow ${isPopular ? 'pt-10' : ''}`}>
                    {/* Header */}
                    <div className="mb-5">
                      <h2 className="text-[13px] font-medium text-[#8a9299] mb-1">{tier.name}</h2>
                      <p className="text-[11px] text-[#3a4250] leading-relaxed">{tier.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-6 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {tier.price_monthly !== null && tier.price_monthly > 0 ? (
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-stat font-semibold text-white tracking-heading">
                              {formatPrice(tier.price_monthly)}
                            </span>
                            <span className="text-gray-500 text-body">/month</span>
                          </div>
                          <p className="text-gray-500 text-small mt-2">
                            Billed monthly · Cancel anytime
                          </p>
                        </div>
                      ) : tier.price_yearly !== null && tier.price_yearly > 0 ? (
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-stat font-semibold text-white tracking-heading">
                              {formatPrice(tier.price_yearly)}
                            </span>
                            <span className="text-gray-500 text-body">/year</span>
                          </div>
                          <div className="mt-2 inline-block bg-emerald-500/15 text-emerald-400 text-small font-medium px-3 py-1 rounded">
                            Save 25% vs monthly
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-stat font-semibold text-white tracking-heading">Free</span>
                          <p className="text-gray-500 text-small mt-2">Forever free plan</p>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="flex-grow mb-6">
                      {Object.entries(featureCategories).map(([category, features], categoryIndex) => {
                        if (features.length === 0) return null

                        return (
                          <div key={category} className={categoryIndex > 0 ? 'mt-2' : ''}>
                            {category !== 'other' && (
                              <h3 className="label text-gray-500 mb-2">
                                {category === 'analysis' && 'Analysis'}
                                {category === 'insights' && 'Insights'}
                                {category === 'personalization' && 'Personalization'}
                              </h3>
                            )}
                            <ul className="space-y-1.5">
                              {features.map((feature, index) => (
                                <li key={index} className="flex items-start gap-2.5">
                                  <Check
                                    size={14}
                                    className={`flex-shrink-0 mt-0.5 ${isPopular ? 'text-[#c8cdd4]' : 'text-[#c8cdd4]/50'}`}
                                  />
                                  <span className={`text-small leading-relaxed ${isPopular ? 'text-[#8a9299]' : 'text-[#5a6270]'}`}>{feature.replace(/\s+/g, ' ').trim()}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>

                    {/* CTA Button */}
                    <div className="mt-auto">
                      {tier.id === 'free' ? (
                        user ? (
                          currentTier === 'free' ? (
                            <div className="text-center py-2 px-4 rounded-md bg-surface-2 shadow-card text-gray-400 font-medium text-body">
                              Current Plan
                            </div>
                          ) : (
                            <div className="text-center py-2 text-gray-500 font-medium text-body">
                              -
                            </div>
                          )
                        ) : (
                          <a
                            href="/signup"
                            className="block w-full text-center px-6 py-2 bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] rounded-md font-medium text-body transition-colors shadow-btn-primary"
                          >
                            Start Free
                          </a>
                        )
                      ) : tier.id === 'enterprise' ? (
                        <a
                          href="mailto:support@chessdata.app"
                          className="block w-full text-center px-5 py-2 text-gray-400 rounded-md font-medium text-body transition-colors" style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          Contact Sales
                        </a>
                      ) : user ? (
                        shouldShowButton(tier.id) ? (
                          <button
                            onClick={() => handleUpgrade(tier.id)}
                            disabled={upgrading === tier.id}
                            className={`w-full px-6 py-2 rounded-md font-medium text-body transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              tier.id === 'pro_yearly'
                                ? 'bg-transparent text-[#7a8290] shadow-card'
                                : 'bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] shadow-btn-primary'
                            }`}
                          >
                            {upgrading === tier.id ? (
                              <span className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-gray-300"></div>
                                Processing...
                              </span>
                            ) : (
                              getButtonText(tier.id)
                            )}
                          </button>
                        ) : (
                          <div className="text-center py-2 px-4 rounded-md bg-white/[0.06] shadow-card text-gray-300 font-medium text-body">
                            Current Plan
                          </div>
                        )
                      ) : (
                        <a
                          href="/signup"
                          className={`block w-full text-center px-6 py-2 rounded-md font-medium text-body transition-colors ${
                            tier.id === 'pro_yearly'
                              ? 'bg-transparent text-[#7a8290] shadow-card'
                              : 'bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] shadow-btn-primary'
                          }`}
                        >
                          Become Pro
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Value Metrics Section */}
          <div className="mb-10">
            <div className="bg-surface-1 shadow-card rounded-lg p-6">
              <h2 className="text-title font-semibold text-[#f0f0f0] tracking-heading mb-8 text-center">
                What You Get
              </h2>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="text-center p-5 bg-surface-2 rounded-lg">
                  <div className="text-section font-semibold text-[#f0f0f0] tracking-section mb-2">Tal Commentary</div>
                  <p className="text-gray-500 text-small leading-relaxed">
                    Mikhail Tal inspired thoughtful explanations of every move. Learn the principles and story behind each decision.
                  </p>
                </div>
                <div className="text-center p-5 bg-surface-2 rounded-lg">
                  <div className="text-section font-semibold text-[#f0f0f0] tracking-section mb-2">6-Dimensional</div>
                  <p className="text-gray-500 text-small leading-relaxed">
                    Your chess personality mapped across 6 metrics. Understand your playing style like never before.
                  </p>
                </div>
                <div className="text-center p-5 bg-surface-2 rounded-lg">
                  <div className="text-section font-semibold text-[#f0f0f0] tracking-section mb-2">Track Progress</div>
                  <p className="text-gray-500 text-small leading-relaxed">
                    ELO trends, phase-specific accuracy, and performance analytics over time.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-small text-gray-400">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-400/60" />
                    <span>No credit card required for free plan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-400/60" />
                    <span>Cancel anytime, no questions asked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-400/60" />
                    <span>14-day money-back guarantee</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Value Proposition Section */}
          <div className="mb-10">
            <div className="bg-surface-1 shadow-card rounded-lg p-6">
              <h2 className="text-title font-semibold text-[#f0f0f0] tracking-heading mb-8 text-center">
                Why chessdata.app?
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(228,232,237,0.06)' }}>
                    <Zap size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-body font-semibold text-[#f0f0f0] mb-1">Stockfish 17.1 Engine</h3>
                    <p className="text-gray-500 text-small leading-relaxed">
                      Professional-grade analysis. Understand why moves work or fail with precise evaluations.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(228,232,237,0.06)' }}>
                    <Brain size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-body font-semibold text-[#f0f0f0] mb-1">Personalized Openings</h3>
                    <p className="text-gray-500 text-small leading-relaxed">
                      Recommendations tailored to your playing style, not generic theory.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(228,232,237,0.06)' }}>
                    <BarChart3 size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-body font-semibold text-[#f0f0f0] mb-1">Personality Insights</h3>
                    <p className="text-gray-500 text-small leading-relaxed">
                      Discover your natural playing style and get matched opening recommendations.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(228,232,237,0.06)' }}>
                    <TrendingUp size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-body font-semibold text-[#f0f0f0] mb-1">Real-time Analysis</h3>
                    <p className="text-gray-500 text-small leading-relaxed">
                      Instant feedback on your games. Review mistakes immediately after playing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-10">
            <div className="text-center mb-8">
              <h2 className="text-title font-semibold text-[#f0f0f0] tracking-heading mb-3">
                Frequently Asked Questions
              </h2>
              <p className="text-gray-500 text-body">
                Everything you need to know about our chess analysis platform.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-surface-1 shadow-card rounded-lg p-5">
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">
                  How accurate is the analysis?
                </h3>
                <p className="text-gray-400 text-small leading-relaxed">
                  Our analysis is powered by Stockfish 17.1, the world's strongest chess engine. It evaluates positions with professional-grade accuracy, providing move classifications (brilliant, best, excellent, mistake, blunder) that align with industry standards.
                </p>
              </div>
              <div className="bg-surface-1 shadow-card rounded-lg p-5">
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">
                  Can I analyze games from both Lichess and Chess.com?
                </h3>
                <p className="text-gray-400 text-small leading-relaxed">
                  Yes! Import and analyze games from both platforms. Search for your username and we'll fetch your games automatically.
                </p>
              </div>
              <div className="bg-surface-1 shadow-card rounded-lg p-5">
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">
                  How does personality analysis work?
                </h3>
                <p className="text-gray-400 text-small leading-relaxed">
                  We analyze your playing style across 6 traits: Aggressive, Patient, Tactical, Positional, Materialistic, and Risk-taking. Based on your patterns, we provide matched opening recommendations.
                </p>
              </div>
              <div className="bg-surface-1 shadow-card rounded-lg p-5">
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">
                  Can I cancel my subscription anytime?
                </h3>
                <p className="text-gray-400 text-small leading-relaxed">
                  Absolutely. Cancel at any time with no questions asked. You'll keep access until the end of your billing period. We also offer a 14-day money-back guarantee.
                </p>
              </div>
              <div className="bg-surface-1 shadow-card rounded-lg p-5">
                <h3 className="text-body font-semibold text-[#f0f0f0] mb-2">
                  Is my payment information secure?
                </h3>
                <p className="text-gray-400 text-small leading-relaxed">
                  Yes. We use Stripe for payment processing, which is PCI DSS compliant. We never store your credit card information on our servers.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center space-y-6">
            <div className="bg-surface-1 shadow-card rounded-lg p-5 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <Shield size={18} className="text-emerald-400/60" />
                <h3 className="text-body font-semibold text-[#f0f0f0]">14-Day Money-Back Guarantee</h3>
              </div>
              <p className="text-gray-500 text-small">
                Not satisfied? We'll refund your payment, no questions asked.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 text-small">
                All plans include secure payment processing via Stripe. Cancel anytime.
              </p>
              <p className="text-gray-500 text-small">
                Questions? <a href="https://discord.gg/S3ymXCeCqK" target="_blank" rel="noopener noreferrer" className="text-cta hover:text-cta-hover transition-colors font-medium">Contact our support team</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
