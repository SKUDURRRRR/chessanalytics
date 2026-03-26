// Enhanced Authentication Context with Usage Tracking and Linked Chess Accounts
// @refresh reset — file exports both a component and a hook, which is incompatible with Fast Refresh
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { logger } from '../utils/logger'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'
import { useToast } from './ToastContext'

interface User {
  id: string
  email: string
  accountTier?: string
  chessComUsername?: string
  lichessUsername?: string
  primaryPlatform?: 'chess.com' | 'lichess'
  onboardingCompleted?: boolean
}

interface UsageBucket {
  used: number
  limit: number | null
  remaining: number | null
  unlimited: boolean
}

interface UsageStats {
  account_tier?: string
  tier_name?: string
  subscription_status?: string
  subscription_end_date?: string
  is_unlimited?: boolean
  imports?: UsageBucket
  analyses?: UsageBucket
  coach_lessons?: UsageBucket
  coach_puzzles?: UsageBucket
  chess_com_username?: string
  lichess_username?: string
  primary_platform?: string
  onboarding_completed?: boolean
  resets_in_hours?: number
}

interface AuthContextType {
  user: User | null
  loading: boolean
  profileLoaded: boolean
  usageStats: UsageStats | null
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  signInWithChessCom: () => Promise<{ error: any }>
  signInWithOAuth: (provider: 'google' | 'lichess' | 'chess_com', returnTo?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  updateProfile: (data: Record<string, any>) => Promise<{ error: any }>
  refreshUsageStats: () => Promise<void>
  linkChessAccount: (platform: 'chess.com' | 'lichess', username: string) => Promise<{ error: any; games_claimed?: number }>
  unlinkChessAccount: (platform: 'chess.com' | 'lichess') => Promise<{ error: any }>
  completeOnboarding: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = import.meta.env.VITE_ANALYSIS_API_URL || 'http://localhost:8002'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const shownConnectionError = useRef(false)

  // Helper to update user from usage stats response
  const updateUserFromStats = useCallback((userId: string, email: string, stats: UsageStats) => {
    setUser(prev => {
      const next = {
        id: userId,
        email,
        accountTier: stats.account_tier,
        chessComUsername: stats.chess_com_username,
        lichessUsername: stats.lichess_username,
        primaryPlatform: stats.primary_platform as 'chess.com' | 'lichess' | undefined,
        onboardingCompleted: stats.onboarding_completed
      }
      // Only update if values actually changed to prevent infinite re-render loops
      if (prev && prev.id === next.id && prev.email === next.email &&
          prev.accountTier === next.accountTier &&
          prev.chessComUsername === next.chessComUsername &&
          prev.lichessUsername === next.lichessUsername &&
          prev.primaryPlatform === next.primaryPlatform &&
          prev.onboardingCompleted === next.onboardingCompleted) {
        return prev
      }
      return next
    })
  }, [])

  const fetchUsageStats = useCallback(async (userId: string, email?: string) => {
    // Input validation
    if (!userId || typeof userId !== 'string') {
      logger.error('Invalid userId provided to fetchUsageStats')
      return
    }

    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        logger.warn('No active session when fetching usage stats')
        return
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/auth/check-usage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ user_id: userId })
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (response.ok) {
        const stats = await response.json()
        setUsageStats(stats)
        // Update user with linked account info from stats
        const userEmail = email || session.session.user?.email || ''
        updateUserFromStats(userId, userEmail, stats)
        shownConnectionError.current = false
        logger.log('Usage stats fetched successfully')
      } else {
        if (response.status !== 0) {
          logger.warn(`Failed to fetch usage stats: ${response.status}`)
          showToast('Could not load account data. Some features may be unavailable.', 'warning')
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('ERR_CONNECTION_REFUSED') ||
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('Network request failed')) {
        logger.log('Backend server not available, skipping usage stats fetch')
        if (!shownConnectionError.current) {
          shownConnectionError.current = true
          showToast('Cannot connect to server. Please check your connection.', 'error')
        }
      } else {
        logger.error('Error fetching usage stats:', error)
        showToast('Something went wrong loading your account.', 'error')
      }
    } finally {
      setProfileLoaded(true)
    }
  }, [updateUserFromStats, showToast])

  useEffect(() => {
    // Listen for auth changes (fires immediately with current session on mount)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!
        })
        fetchUsageStats(session.user.id, session.user.email!)
      } else {
        setUser(null)
        setUsageStats(null)
        setProfileLoaded(true)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchUsageStats])

  const refreshUsageStats = useCallback(async () => {
    if (user) {
      await fetchUsageStats(user.id, user.email)
    }
  }, [user, fetchUsageStats])

  const signIn = useCallback(async (email: string, password: string) => {
    // Input validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { error: new Error('Valid email is required') }
    }
    if (!password || typeof password !== 'string' || password.length < 6) { // pragma: allowlist secret
      return { error: new Error('Password must be at least 6 characters') }
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        logger.warn('Sign in failed:', error.message)
      } else {
        logger.log('Sign in successful')
      }

      return { error }
    } catch (error) {
      logger.error('Sign in error:', error)
      return { error: error as Error }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    // Input validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { error: new Error('Valid email is required') }
    }
    if (!password || typeof password !== 'string' || password.length < 6) { // pragma: allowlist secret
      return { error: new Error('Password must be at least 6 characters') }
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      })

      // The database trigger (on_auth_user_created) automatically creates
      // the authenticated_users record when a new user signs up.
      // No need to manually insert - the trigger handles it with elevated permissions.

      if (error) {
        logger.warn('Sign up failed:', error.message)
      } else {
        logger.log('Sign up successful')
      }

      return { error }
    } catch (error) {
      logger.error('Sign up error:', error)
      return { error: error as Error }
    }
  }, [])

  const signInWithOAuth = useCallback(async (provider: 'google' | 'lichess' | 'chess_com', returnTo: string = '/') => {
    // Input validation
    const validProviders = ['google', 'lichess', 'chess_com']
    if (!validProviders.includes(provider)) {
      logger.error(`Invalid OAuth provider: ${provider}`)
      return { error: new Error('Invalid OAuth provider') }
    }

    try {
      // Map chess_com to the actual provider name used by Supabase
      const supabaseProvider = provider === 'chess_com' ? 'chess_com' : provider

      // Validate returnTo is a relative path (security)
      const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/'

      // Store returnTo in sessionStorage so we can use it after OAuth callback
      sessionStorage.setItem('auth_return_to', safeReturnTo)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as any,
        options: {
          redirectTo: `${window.location.origin}/`
        }
      })

      if (error) {
        logger.error(`OAuth sign in failed for ${provider}:`, error.message)
      } else {
        logger.log(`OAuth sign in initiated for ${provider}`)
      }

      return { error }
    } catch (error) {
      logger.error('OAuth error:', error)
      return { error: error as Error }
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    return signInWithOAuth('google')
  }, [signInWithOAuth])

  const signInWithChessCom = useCallback(async () => {
    return signInWithOAuth('chess_com')
  }, [signInWithOAuth])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUsageStats(null)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    // Input validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { error: new Error('Valid email is required') }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        logger.warn('Password reset failed:', error.message)
      } else {
        logger.log('Password reset email sent')
      }

      return { error }
    } catch (error) {
      logger.error('Password reset error:', error)
      return { error: error as Error }
    }
  }, [])

  const updateProfile = useCallback(async (data: Record<string, any>) => {
    // Input validation
    if (!data || typeof data !== 'object') {
      return { error: new Error('Valid data object is required') }
    }

    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        logger.warn('Attempted to update profile without authentication')
        return { error: new Error('Not authenticated') }
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/auth/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify(data)
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        const errorData = await response.json()
        logger.warn('Profile update failed:', errorData.detail)
        return { error: new Error(errorData.detail || 'Failed to update profile') }
      }

      logger.log('Profile updated successfully')
      return { error: null }
    } catch (error) {
      logger.error('Profile update error:', error)
      return { error: error as Error }
    }
  }, [])

  const linkChessAccount = useCallback(async (platform: 'chess.com' | 'lichess', username: string) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        return { error: new Error('Not authenticated') }
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/auth/link-chess-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ platform, username })
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      const data = await response.json()

      if (!response.ok) {
        const msg = data.message || data.detail || 'Failed to link account'
        showToast(msg, 'error')
        return { error: new Error(msg) }
      }

      // Refresh usage stats to update linked account info
      await refreshUsageStats()
      showToast(`Connected ${platform} account: ${username}`, 'success')
      logger.log(`Linked ${platform} account: ${username}`)
      return { error: null, games_claimed: data.games_claimed }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to link account'
      logger.error('Link chess account error:', error)
      if (msg.includes('Failed to fetch') || msg.includes('ERR_CONNECTION_REFUSED')) {
        showToast('Cannot connect to server. Is the backend running?', 'error')
      } else {
        showToast(`Failed to connect account: ${msg}`, 'error')
      }
      return { error: error as Error }
    }
  }, [refreshUsageStats, showToast])

  const unlinkChessAccount = useCallback(async (platform: 'chess.com' | 'lichess') => {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        return { error: new Error('Not authenticated') }
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/auth/unlink-chess-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ platform })
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        const data = await response.json()
        const msg = data.detail || 'Failed to unlink account'
        showToast(msg, 'error')
        return { error: new Error(msg) }
      }

      await refreshUsageStats()
      showToast(`Disconnected ${platform} account`, 'info')
      logger.log(`Unlinked ${platform} account`)
      return { error: null }
    } catch (error) {
      logger.error('Unlink chess account error:', error)
      showToast('Failed to disconnect account. Please try again.', 'error')
      return { error: error as Error }
    }
  }, [refreshUsageStats, showToast])

  const completeOnboarding = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        return { error: new Error('Not authenticated') }
      }

      const response = await fetchWithTimeout(
        `${API_URL}/api/v1/auth/complete-onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`
          }
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        const data = await response.json()
        return { error: new Error(data.detail || 'Failed to complete onboarding') }
      }

      // Update local user state
      setUser(prev => prev ? { ...prev, onboardingCompleted: true } : null)
      return { error: null }
    } catch (error) {
      logger.error('Complete onboarding error:', error)
      return { error: error as Error }
    }
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    profileLoaded,
    usageStats,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithChessCom,
    signInWithOAuth,
    signOut,
    resetPassword,
    updateProfile,
    refreshUsageStats,
    linkChessAccount,
    unlinkChessAccount,
    completeOnboarding
  }), [user, loading, profileLoaded, usageStats, signIn, signUp, signInWithGoogle, signInWithChessCom, signInWithOAuth, signOut, resetPassword, updateProfile, refreshUsageStats, linkChessAccount, unlinkChessAccount, completeOnboarding])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
