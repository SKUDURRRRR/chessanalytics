// Enhanced Authentication Context with Usage Tracking
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'

interface User {
  id: string
  email: string
  accountTier?: string
}

interface UsageStats {
  account_tier?: string
  tier_name?: string
  subscription_status?: string
  subscription_end_date?: string
  is_unlimited?: boolean
  imports?: {
    used: number
    limit: number | null
    remaining: number | null
    unlimited: boolean
  }
  analyses?: {
    used: number
    limit: number | null
    remaining: number | null
    unlimited: boolean
  }
  resets_in_hours?: number
}

interface AuthContextType {
  user: User | null
  loading: boolean
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!
        })
        // Fetch usage stats for authenticated users
        fetchUsageStats(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!
        })
        // Fetch usage stats when user logs in
        fetchUsageStats(session.user.id)
      } else {
        setUser(null)
        setUsageStats(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUsageStats = async (userId: string) => {
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
        logger.log('Usage stats fetched successfully')
      } else {
        logger.warn(`Failed to fetch usage stats: ${response.status}`)
      }
    } catch (error) {
      logger.error('Error fetching usage stats:', error)
      // Don't throw - fail gracefully
    }
  }

  const refreshUsageStats = useCallback(async () => {
    if (user) {
      await fetchUsageStats(user.id)
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
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
  }

  const signUp = async (email: string, password: string) => {
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

      // If signup successful and user is created, create authenticated_users record
      if (!error) {
        const { data: session } = await supabase.auth.getSession()
        if (session.session?.user) {
          try {
            // Create authenticated_users record via Supabase client
            await supabase.from('authenticated_users').insert({
              id: session.session.user.id,
              account_tier: 'free'
            })
            logger.log('User profile created successfully')
          } catch (dbError) {
            logger.error('Error creating user profile:', dbError)
            // Don't fail the signup if profile creation fails
            // The database trigger should handle this as fallback
          }
        }
        logger.log('Sign up successful')
      } else {
        logger.warn('Sign up failed:', error.message)
      }

      return { error }
    } catch (error) {
      logger.error('Sign up error:', error)
      return { error: error as Error }
    }
  }

  const signInWithGoogle = async () => {
    return signInWithOAuth('google')
  }

  const signInWithChessCom = async () => {
    return signInWithOAuth('chess_com')
  }

  const signInWithOAuth = async (provider: 'google' | 'lichess' | 'chess_com', returnTo: string = '/') => {
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
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUsageStats(null)
  }

  const resetPassword = async (email: string) => {
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
  }

  const updateProfile = async (data: Record<string, any>) => {
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
  }

  const value = {
    user,
    loading,
    usageStats,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithChessCom,
    signInWithOAuth,
    signOut,
    resetPassword,
    updateProfile,
    refreshUsageStats
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
