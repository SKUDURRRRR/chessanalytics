import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

export default function ProfilePage() {
  const { user, usageStats, refreshUsageStats, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cancellingSubscription, setCancellingSubscription] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [hasPasswordAuth, setHasPasswordAuth] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    // Check if user has email/password authentication
    const checkPasswordAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.identities) {
        const hasEmailPassword = session.user.identities.some(
          (identity: any) => identity.provider === 'email'
        )
        setHasPasswordAuth(hasEmailPassword)
      }
    }
    checkPasswordAuth()

    // Check if we were redirected from Stripe checkout
    const urlParams = new URLSearchParams(window.location.search)
    const sessionId = urlParams.get('session_id')

    if (sessionId && !verifyingPayment) {
      // Verify the payment with our backend
      verifyStripeSession(sessionId)
    } else {
      refreshUsageStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]) // Only run when user changes, not refreshUsageStats

  const verifyStripeSession = async (sessionId: string) => {
    // Input validation
    if (!sessionId || typeof sessionId !== 'string') {
      logger.error('Invalid sessionId provided to verifyStripeSession')
      setError('Invalid session ID')
      return
    }

    setVerifyingPayment(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        logger.warn('No session found when verifying payment')
        setError('Please log in to verify payment')
        return
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/payments/verify-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ session_id: sessionId })
        },
        TIMEOUT_CONFIG.LONG // Payment verification might take a while
      )

      if (!response.ok) {
        const errorData = await response.json()
        logger.warn('Payment verification failed:', errorData.detail)
        setError(errorData.detail || 'Failed to verify payment')
        return
      }

      const data = await response.json()

      if (data.success) {
        logger.log('Payment verified successfully')
        setNotification({
          message: data.message || 'Payment successful! Your subscription is now active.',
          type: 'success'
        })

        // Clean up URL
        window.history.replaceState({}, '', '/profile')

        // Refresh usage stats to show updated tier
        await refreshUsageStats()
      } else {
        logger.warn('Payment verification unsuccessful:', data.message)
        setError(data.message || 'Payment verification failed')
      }
    } catch (error) {
      logger.error('Error verifying payment:', error)
      setError('Failed to verify payment. Please refresh the page.')
    } finally {
      setVerifyingPayment(false)
    }
  }

  // Debug log to see what we're getting
  useEffect(() => {
    if (usageStats) {
      logger.log('🔍 Usage Stats:', {
        subscription_status: usageStats.subscription_status,
        subscription_end_date: usageStats.subscription_end_date,
        account_tier: usageStats.account_tier
      })
    }
  }, [usageStats])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setChangingPassword(true)

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      setChangingPassword(false)
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      setChangingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      setChangingPassword(false)
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password')
      setChangingPassword(false)
      return
    }

    try {
      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      })

      if (signInError) {
        logger.warn('Current password verification failed:', signInError.message)
        setPasswordError('Current password is incorrect')
        setChangingPassword(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        logger.warn('Password update failed:', updateError.message)
        setPasswordError(updateError.message || 'Failed to update password')
        setChangingPassword(false)
        return
      }

      logger.log('Password updated successfully')
      setNotification({
        message: 'Password changed successfully',
        type: 'success'
      })

      // Reset form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordChange(false)

      // Auto-dismiss notification after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    } catch (error) {
      logger.error('Error changing password:', error)
      setPasswordError('An unexpected error occurred. Please try again.')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancellingSubscription(true)
    setShowCancelConfirm(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        logger.warn('No session found when cancelling subscription')
        setError('Please log in to cancel subscription')
        return
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/payments/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        },
        TIMEOUT_CONFIG.LONG
      )

      if (!response.ok) {
        const errorData = await response.json()
        logger.warn('Subscription cancellation failed:', errorData.detail)
        setError(errorData.detail || 'Failed to cancel subscription')
        return
      }

      const data = await response.json()
      logger.log('Subscription cancelled successfully')
      setNotification({
        message: data.message || 'Subscription cancelled successfully',
        type: 'info'
      })
      await refreshUsageStats()

      // Auto-dismiss after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    } catch (error) {
      logger.error('Error cancelling subscription:', error)
      setError('Failed to cancel subscription. Please try again.')
    } finally {
      setCancellingSubscription(false)
    }
  }

  const handleUpgradeToYearly = async () => {
    setLoading(true)
    setError('') // Clear previous errors
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        logger.warn('No session found when upgrading to yearly')
        setError('Please log in to upgrade')
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
            tier_id: 'pro_yearly',
            success_url: `${window.location.origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/profile?canceled=true`
          })
        },
        TIMEOUT_CONFIG.LONG
      )

      if (!response.ok) {
        const errorData = await response.json()
        logger.warn('Checkout creation failed:', errorData.detail)
        setError(errorData.detail || 'Failed to create checkout session')
        return
      }

      const data = await response.json()
      if (data.url) {
        logger.log('Redirecting to Stripe checkout for yearly upgrade')
        window.location.href = data.url
      } else {
        logger.error('No checkout URL received')
        setError('Failed to get checkout URL')
      }
    } catch (error) {
      logger.error('Error upgrading to yearly:', error)
      setError('Failed to upgrade. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchToMonthly = async () => {
    setLoading(true)
    setError('') // Clear previous errors
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        logger.warn('No session found when switching to monthly')
        setError('Please log in to switch plan')
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
            tier_id: 'pro_monthly',
            success_url: `${window.location.origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/profile?canceled=true`
          })
        },
        TIMEOUT_CONFIG.LONG
      )

      if (!response.ok) {
        const errorData = await response.json()
        logger.warn('Checkout creation failed:', errorData.detail)
        setError(errorData.detail || 'Failed to create checkout session')
        return
      }

      const data = await response.json()
      if (data.url) {
        logger.log('Redirecting to Stripe checkout for monthly plan')
        window.location.href = data.url
      } else {
        logger.error('No checkout URL received')
        setError('Failed to get checkout URL')
      }
    } catch (error) {
      logger.error('Error switching to monthly:', error)
      setError('Failed to switch plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (verifyingPayment) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
            <p>Verifying your payment...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-white">Profile</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage your account settings and view your usage stats
          </p>
        </div>

        {error && (
          <div className="bg-rose-900/50 border border-rose-500 text-rose-200 px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        {notification && (
          <div className={`flex items-start justify-between rounded-2xl border px-4 py-3 text-sm ${notification.type === 'success' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-sky-400/40 bg-sky-500/10 text-sky-100'}`}>
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none">{notification.type === 'success' ? '✓' : 'ℹ'}</span>
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

        {/* Cancel Subscription Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="max-w-md w-full rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-3">Cancel Subscription</h3>
              <p className="text-slate-300 text-sm mb-6">
                Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancellingSubscription}
                  className="rounded-2xl border border-rose-400/40 bg-rose-500/20 px-6 py-2.5 text-sm font-semibold text-rose-100 transition hover:border-rose-300/60 hover:bg-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancellingSubscription ? 'Cancelling...' : 'OK'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Information */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-100 shadow-xl shadow-black/40">
          <h2 className="text-xl font-bold text-white mb-4">Account Information</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-400">Email</label>
              <p className="text-white">{user.email}</p>
            </div>

            {usageStats?.account_tier && usageStats.account_tier !== 'free' && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Subscription Plan</label>
                <div className="flex justify-between items-baseline gap-4">
                  <p className="text-white">{usageStats.tier_name || usageStats.account_tier}</p>
                  {usageStats?.subscription_end_date ? (
                    <p className={`text-sm font-medium ${usageStats.subscription_status === 'cancelled' ? 'text-amber-400' : 'text-slate-300'}`}>
                      {usageStats.subscription_status === 'cancelled' ? 'Valid until ' : 'Renews '}
                      {new Date(usageStats.subscription_end_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">(No end date)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Usage Stats */}
        {usageStats && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-100 shadow-xl shadow-black/40">
            <h2 className="text-xl font-bold text-white mb-4">Usage Statistics</h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-300">Account Tier</span>
                  <span className="text-white font-semibold">{usageStats.tier_name || 'Free'}</span>
                </div>
              </div>

              {!usageStats.is_unlimited && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-300">Game Imports</span>
                      <span className="text-white">
                        {usageStats.imports?.used || 0} / {usageStats.imports?.limit || 0}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-sky-400 h-2 rounded-full transition-all"
                        style={{
                          width: `${((usageStats.imports?.used || 0) / (usageStats.imports?.limit || 1)) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {usageStats.imports?.remaining || 0} remaining
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-300">Game Analyses</span>
                      <span className="text-white">
                        {usageStats.analyses?.used || 0} / {usageStats.analyses?.limit || 0}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-emerald-400 h-2 rounded-full transition-all"
                        style={{
                          width: `${((usageStats.analyses?.used || 0) / (usageStats.analyses?.limit || 1)) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {usageStats.analyses?.remaining || 0} remaining
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <p className="text-sm text-slate-400">
                      Limits reset in {usageStats.resets_in_hours?.toFixed(1)} hours
                    </p>
                  </div>
                </>
              )}

              {usageStats.is_unlimited && (
                <div className="text-center py-4">
                  <p className="text-emerald-400 font-semibold">✓ Unlimited Access</p>
                  <p className="text-sm text-slate-400 mt-1">You have unlimited imports and analyses</p>
                </div>
              )}
            </div>

            {!usageStats.is_unlimited && (
              <div className="mt-6">
                <a
                  href="/pricing"
                  className="block w-full text-center rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30"
                >
                  Upgrade to Pro for Unlimited Access
                </a>
              </div>
            )}

            {usageStats.is_unlimited && usageStats.account_tier === 'pro_monthly' && (
              <div className="mt-6 space-y-3">
                {usageStats.subscription_status === 'cancelled' && (
                  <>
                    <button
                      onClick={handleSwitchToMonthly}
                      disabled={loading}
                      className="block w-full text-center rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Resubscribe to Pro Monthly'}
                    </button>
                    <button
                      onClick={handleUpgradeToYearly}
                      disabled={loading}
                      className="block w-full text-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Upgrade to Yearly Pro (Save 25%)'}
                    </button>
                  </>
                )}
                {usageStats.subscription_status !== 'cancelled' && (
                  <>
                    <button
                      onClick={handleUpgradeToYearly}
                      disabled={loading}
                      className="block w-full text-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Upgrade to Yearly Pro (Save 25%)'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={cancellingSubscription}
                      className="block w-full text-center rounded-2xl border border-rose-400/40 bg-rose-500/20 px-6 py-3 text-sm font-semibold text-rose-100 transition hover:border-rose-300/60 hover:bg-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancellingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
                    </button>
                  </>
                )}
              </div>
            )}

            {usageStats.is_unlimited && usageStats.account_tier === 'pro_yearly' && (
              <div className="mt-6 space-y-3">
                {usageStats.subscription_status === 'cancelled' && (
                  <>
                    <button
                      onClick={handleSwitchToMonthly}
                      disabled={loading}
                      className="block w-full text-center rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Switch to Pro Monthly'}
                    </button>
                    <button
                      onClick={handleUpgradeToYearly}
                      disabled={loading}
                      className="block w-full text-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 px-6 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Resubscribe to Pro Yearly'}
                    </button>
                  </>
                )}
                {usageStats.subscription_status !== 'cancelled' && (
                  <>
                    <button
                      onClick={handleSwitchToMonthly}
                      disabled={loading}
                      className="block w-full text-center rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Loading...' : 'Switch to Monthly Pro'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={cancellingSubscription}
                      className="block w-full text-center rounded-2xl border border-rose-400/40 bg-rose-500/20 px-6 py-3 text-sm font-semibold text-rose-100 transition hover:border-rose-300/60 hover:bg-rose-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancellingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-100 shadow-xl shadow-black/40">
          <h2 className="text-xl font-bold text-white mb-4">Actions</h2>
          <div className="space-y-3">
            {hasPasswordAuth && (
              <>
                {!showPasswordChange ? (
                  <button
                    onClick={() => {
                      setShowPasswordChange(true)
                      setPasswordError('')
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="w-full rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30"
                  >
                    Change Password
                  </button>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-4 pt-2 border-t border-white/10">
                    {passwordError && (
                      <div className="bg-rose-900/50 border border-rose-500 text-rose-200 px-4 py-3 rounded-2xl text-sm">
                        {passwordError}
                      </div>
                    )}

                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-2">
                        Current Password
                      </label>
                      <input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                        placeholder="Enter your current password"
                      />
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                        placeholder="Enter your new password (min. 6 characters)"
                      />
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                        placeholder="Confirm your new password"
                      />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordChange(false)
                          setPasswordError('')
                          setCurrentPassword('')
                          setNewPassword('')
                          setConfirmPassword('')
                        }}
                        disabled={changingPassword}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {changingPassword ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
            <button
              onClick={handleSignOut}
              className="w-full rounded-2xl border border-rose-400/40 bg-rose-500/20 px-6 py-3 text-sm font-semibold text-rose-100 transition hover:border-rose-300/60 hover:bg-rose-500/30"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
