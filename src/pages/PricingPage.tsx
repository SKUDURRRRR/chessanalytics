import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'
import { AnalyticsService } from '../services/analyticsService'

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
    // Track pricing page view
    AnalyticsService.trackPricingPageView().catch(err =>
      console.warn('Failed to track pricing page view:', err)
    )
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
    return 'Upgrade Now'
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

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-300">
            Start free, upgrade when you're ready for unlimited access
          </p>
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

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`bg-slate-900 border ${
                tier.id === 'pro_monthly'
                  ? 'border-blue-500 ring-2 ring-blue-500'
                  : 'border-slate-700'
              } rounded-lg p-8 relative flex flex-col`}
            >
              {tier.id === 'pro_monthly' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                  POPULAR
                </div>
              )}

              <h2 className="text-2xl font-semibold text-white mb-2">{tier.name}</h2>
              <p className="text-slate-300 text-sm mb-6">{tier.description}</p>

              <div className="mb-6">
                {tier.price_monthly !== null && tier.price_monthly > 0 ? (
                  <>
                    <span className="text-4xl font-semibold text-white">
                      {formatPrice(tier.price_monthly)}
                    </span>
                    <span className="text-slate-300">/month</span>
                  </>
                ) : tier.price_yearly !== null && tier.price_yearly > 0 ? (
                  <>
                    <span className="text-4xl font-semibold text-white">
                      {formatPrice(tier.price_yearly)}
                    </span>
                    <span className="text-slate-300">/year</span>
                    {tier.price_monthly !== null && (
                      <p className="text-sm text-green-400 mt-1">
                        Save ${((tier.price_monthly * 12) - tier.price_yearly).toFixed(2)}/year
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-4xl font-semibold text-white">Free</span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start text-slate-300 text-sm">
                    <svg
                      className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
              {tier.id === 'free' ? (
                user ? (
                  currentTier === 'free' ? (
                    <div className="text-center py-3 text-slate-300 font-medium">
                      Current Plan
                    </div>
                  ) : (
                    <div className="text-center py-3 text-slate-300 font-medium">
                      —
                    </div>
                  )
                ) : (
                  <a
                    href="/signup"
                    className="block w-full text-center px-4 py-3 bg-slate-700 text-white rounded-md hover:bg-slate-600 font-medium"
                  >
                    Sign Up Free
                  </a>
                )
              ) : tier.id === 'enterprise' ? (
                <a
                  href="mailto:support@chessdata.app"
                  className="block w-full text-center px-4 py-3 bg-slate-700 text-white rounded-md hover:bg-slate-600 font-medium"
                >
                  Contact Sales
                </a>
              ) : user ? (
                shouldShowButton(tier.id) ? (
                  <button
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={upgrading === tier.id}
                    className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {upgrading === tier.id ? 'Loading...' : getButtonText(tier.id)}
                  </button>
                ) : (
                  <div className="text-center py-3 text-emerald-400 font-medium">
                    ✓ Current Plan
                  </div>
                )
              ) : (
                <a
                  href="/signup"
                  className="block w-full text-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Get Started
                </a>
              )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            All plans include access to chess analytics, opening analysis, and personality scores.
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Need help choosing? <a href="mailto:support@chessdata.app" className="text-blue-500 hover:text-blue-400">Contact us</a>
          </p>
        </div>
      </div>
    </div>
  )
}
