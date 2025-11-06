import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'

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
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'
      console.log('🔍 API URL:', API_URL)
      console.log('🔍 Full URL:', `${API_URL}/api/v1/payment-tiers`)

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/payment-tiers`,
        {},
        TIMEOUT_CONFIG.DEFAULT
      )

      console.log('📡 Response status:', response.status)
      console.log('📡 Response ok:', response.ok)

      if (response.ok) {
        const data = await response.json()
        console.log('📦 Data received:', data)
        console.log('📦 Tiers count:', data.tiers?.length || 0)
        setTiers(data.tiers || [])
        logger.log('Pricing tiers fetched successfully')
      } else {
        const errorText = await response.text()
        console.error('❌ API Error Response:', errorText)
        logger.warn('Failed to fetch pricing tiers:', response.status)
        // Fail gracefully - UI will show empty state
      }
    } catch (error) {
      console.error('❌ Fetch error:', error)
      logger.error('Error fetching tiers:', error)
      // Fail gracefully - UI will show empty state
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
    if (currentTier === 'pro_monthly' && tierId === 'pro_yearly') {
      return 'Upgrade to Yearly'
    }
    if (currentTier === 'pro_yearly' && tierId === 'pro_monthly') {
      return 'Switch to Monthly'
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
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading pricing...</div>
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
      } else if (lower.includes('personality') || lower.includes('opening') || lower.includes('repertoire') || lower.includes('unlimited') || lower.includes('import') || lower.includes('limit') || lower.includes('analytics') || lower.includes('analyses') || lower.includes('tracking') || lower.includes('position exploration') || lower.includes('tal inspired') || lower.includes('playstyle') || lower.includes('learning suggestions')) {
        categories.insights.push(feature)
      } else {
        categories.other.push(feature)
      }
    })

    return categories
  }

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(14,116,144,0.15),_transparent_50%)]" />

      <div className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs uppercase tracking-wide text-blue-200 mb-6">
              <span className="text-base">♟</span>
              <span>Professional Chess Analysis</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Transform Your Chess Game
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed">
              Powered by <span className="text-blue-400 font-semibold">Stockfish 17.1</span>, the world's strongest chess engine.
              Understand your mistakes, discover your playing style, and improve faster with insights that help you play better chess.
            </p>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 mb-8">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Secure Payment</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Real-time Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>AI-Powered Insights</span>
              </div>
            </div>
          </div>

          {notification && (
            <div className={`max-w-2xl mx-auto mb-8 flex items-start justify-between rounded-2xl border px-4 py-3 text-sm ${notification.type === 'error' ? 'border-rose-400/40 bg-rose-500/10 text-rose-100' : 'border-sky-400/40 bg-sky-500/10 text-sky-100'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none">{notification.type === 'error' ? '⚠' : 'ℹ'}</span>
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="ml-3 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                OK
              </button>
            </div>
          )}

          {/* Use Case Scenarios */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Built for Every Chess Player
              </h2>
              <p className="text-slate-400 text-lg">
                Whether you're improving your game or coaching others, our analysis helps you understand chess at a deeper level.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Improving Player</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Identify patterns in your play, discover your weaknesses, and track improvement over time. Move from intuition to understanding.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Coaches & Instructors</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Analyze your students' games efficiently. Get detailed insights to guide training and identify areas for focused improvement.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Clubs & Teams</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Review tournament games, analyze team performance, and prepare for competitions with comprehensive game analysis.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-10 md:gap-6 lg:gap-8 max-w-6xl mx-auto mb-16">
            {tiers.map((tier) => {
              const isPopular = tier.id === 'pro_monthly'
              const featureCategories = categorizeFeatures(tier.features)
              const monthlyEquivalent = tier.price_yearly && tier.price_monthly
                ? (tier.price_yearly / 12).toFixed(2)
                : null

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-2xl border transition-all duration-300 ${
                    isPopular
                      ? 'border-blue-500/50 ring-2 ring-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl shadow-blue-500/20 scale-105 md:scale-105'
                      : 'border-slate-700/50 bg-slate-900/50 backdrop-blur-sm hover:border-slate-600/50'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                      MOST POPULAR
                    </div>
                  )}

                  <div className="p-8 flex flex-col flex-grow">
                    {/* Header */}
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-white mb-2">{tier.name}</h2>
                      <p className="text-slate-400 text-sm leading-relaxed">{tier.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-8 pb-8 border-b border-slate-700/50">
                      {tier.price_monthly !== null && tier.price_monthly > 0 ? (
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-white">
                              {formatPrice(tier.price_monthly)}
                            </span>
                            <span className="text-slate-400 text-lg">/month</span>
                          </div>
                          <p className="text-slate-500 text-sm mt-2">
                            Billed monthly • Cancel anytime
                          </p>
                        </div>
                      ) : tier.price_yearly !== null && tier.price_yearly > 0 ? (
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-white">
                              {formatPrice(tier.price_yearly)}
                            </span>
                            <span className="text-slate-400 text-lg">/year</span>
                          </div>
                          {monthlyEquivalent && (
                            <p className="text-green-400 font-semibold text-sm mt-1">
                              ${monthlyEquivalent}/month
                            </p>
                          )}
                          {tier.price_monthly !== null && (
                            <p className="text-green-400 text-sm mt-2">
                              Save ${((tier.price_monthly * 12) - tier.price_yearly).toFixed(2)}/year • 25% off
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-5xl font-bold text-white">Free</span>
                          <p className="text-slate-500 text-sm mt-2">Forever free plan</p>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="flex-grow mb-8">
                      {Object.entries(featureCategories).map(([category, features], categoryIndex) => {
                        if (features.length === 0) return null

                        return (
                          <div key={category} className={categoryIndex > 0 ? 'mt-2' : ''}>
                            {category !== 'other' && (
                              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {category === 'analysis' && 'Analysis'}
                                {category === 'insights' && 'Insights'}
                                {category === 'personalization' && 'Personalization'}
                              </h3>
                            )}
                            <ul className="space-y-1.5">
                              {features.map((feature, index) => (
                                <li key={index} className="flex items-start gap-3">
                                  <svg
                                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                      isPopular ? 'text-blue-400' : 'text-green-400'
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2.5}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  <span className="text-slate-300 text-sm leading-relaxed">{feature.replace(/\s+/g, ' ').trim()}</span>
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
                            <div className="text-center py-3 px-4 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 font-medium">
                              ✓ Current Plan
                            </div>
                          ) : (
                            <div className="text-center py-3 text-slate-500 font-medium">
                              —
                            </div>
                          )
                        ) : (
                          <a
                            href="/signup"
                            className="block w-full text-center px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors shadow-lg"
                          >
                            Become Pro
                          </a>
                        )
                      ) : tier.id === 'enterprise' ? (
                        <a
                          href="mailto:support@chessdata.app"
                          className="block w-full text-center px-6 py-3.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                        >
                          Contact Sales
                        </a>
                      ) : user ? (
                        shouldShowButton(tier.id) ? (
                          <button
                            onClick={() => handleUpgrade(tier.id)}
                            disabled={upgrading === tier.id}
                            className={`w-full px-6 py-3.5 rounded-lg font-semibold transition-all shadow-lg ${
                              isPopular
                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                          >
                            {upgrading === tier.id ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                              </span>
                            ) : (
                              getButtonText(tier.id)
                            )}
                          </button>
                        ) : (
                          <div className="text-center py-3 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                            ✓ Current Plan
                          </div>
                        )
                      ) : (
                        <a
                          href="/signup"
                          className={`block w-full text-center px-6 py-3.5 rounded-lg font-semibold transition-all shadow-lg ${
                            isPopular
                              ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white'
                              : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                        >
                          Start Free Trial
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Value Metrics Section */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8 md:p-12">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 text-center">
                What You Get
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-blue-400 mb-2">Tal Commentary</div>
                  <p className="text-slate-300 text-sm">
                    Not just generic AI comments — Mikhail Tal inspired thoughtful explanations of every move. Learn the principles, patterns, and story behind each decision.
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-purple-400 mb-2">6-Dimensional</div>
                  <p className="text-slate-300 text-sm">
                    Your chess personality mapped across 6 metrics. Understand your playing style like never before.
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-green-400 mb-2">Track Progress</div>
                  <p className="text-slate-300 text-sm">
                    ELO trends, phase-specific accuracy, and performance analytics. Watch your improvement over time.
                  </p>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-700/50">
                <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>No credit card required for free plan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Cancel anytime, no questions asked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>14-day money-back guarantee</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Value Proposition Section */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-slate-700/50 rounded-2xl p-8 md:p-12">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-12 text-center">
                Why chessdata.app?
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Stockfish 17.1 Engine</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Get the same analysis quality used by professional players. Understand why moves work or fail with precise evaluations.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Personalized Openings</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Build your perfect opening repertoire. Get recommendations tailored to your playing style, not generic theory that doesn't fit how you play.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Personality Insights</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Discover your natural playing style and get opening recommendations that match how you actually play, not generic advice.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Real-time Analysis</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Get instant feedback on your games. Review mistakes immediately after playing to improve faster.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-slate-400 text-lg">
                Everything you need to know about our chess analysis platform.
              </p>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  How accurate is the analysis?
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Our analysis is powered by Stockfish 17.1, the world's strongest chess engine. It evaluates positions with professional-grade accuracy, providing move classifications (best, excellent, mistake, blunder) that align with industry standards used by Chess.com and Lichess.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Can I analyze games from both Lichess and Chess.com?
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Yes! You can import and analyze games from both platforms. Simply search for your username on either platform, and we'll fetch your games automatically. You can analyze games from multiple accounts in one place.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  How does personality analysis work?
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Our system analyzes your playing style across 6 traits: Aggressive, Patient, Tactical, Positional, Materialistic, and Risk-taking. Based on your patterns, we provide opening recommendations that match your natural playing style, helping you play more effectively.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Can I cancel my subscription anytime?
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Absolutely. You can cancel your subscription at any time with no questions asked. You'll continue to have access until the end of your billing period. We also offer a 14-day money-back guarantee if you're not satisfied.
                </p>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Is my payment information secure?
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Yes. We use Stripe for all payment processing, which is PCI DSS compliant and used by millions of companies worldwide. We never store your credit card information on our servers.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center space-y-6">
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl p-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-lg font-semibold text-white">14-Day Money-Back Guarantee</h3>
              </div>
              <p className="text-slate-300 text-sm">
                Not satisfied? We'll refund your payment, no questions asked.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">
                All plans include secure payment processing via Stripe. Cancel anytime, no questions asked.
              </p>
              <p className="text-slate-500 text-sm">
                Questions? <a href="https://discord.gg/S3ymXCeCqK" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">Contact our support team</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
