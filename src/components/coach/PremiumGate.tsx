/**
 * Premium Gate Component
 * Wrapper that checks premium status and shows upgrade modal if needed
 */

import { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface PremiumGateProps {
  children: ReactNode
}

export function PremiumGate({ children }: PremiumGateProps) {
  const { user, usageStats, loading } = useAuth()
  const navigate = useNavigate()

  // Wait for auth to load before checking premium
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    // Redirect to login
    navigate('/login')
    return null
  }

  // Check if user has premium
  // Allow 'trialing' status as well (backend allows both 'active' and 'trialing')
  // Also check if account_tier contains 'pro' or 'enterprise' (case-insensitive)
  const accountTier = usageStats?.account_tier?.toLowerCase() || ''
  const subscriptionStatus = usageStats?.subscription_status?.toLowerCase() || ''

  const isPremiumTier = accountTier && (
    accountTier.includes('pro') ||
    accountTier.includes('enterprise') ||
    ['pro', 'pro_monthly', 'pro_yearly', 'enterprise'].includes(accountTier)
  )

  const isActiveStatus = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  const isPremium = isPremiumTier && isActiveStatus

  if (!isPremium) {
    // Show upgrade modal
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg shadow-card bg-surface-1 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Coach Features</h2>
          <p className="text-gray-400 mb-6">
            Personalized lessons, puzzles, and progress tracking are available with a premium subscription.
          </p>
          <button
            onClick={() => navigate('/pricing')}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Upgrade to Premium
          </button>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 w-full text-gray-500 hover:text-gray-400 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
