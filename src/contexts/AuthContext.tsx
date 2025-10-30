// Enhanced Authentication Context with Usage Tracking
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

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
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) return

      const response = await fetch(`${API_URL}/api/v1/auth/check-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({ user_id: userId })
      })

      if (response.ok) {
        const stats = await response.json()
        setUsageStats(stats)
      }
    } catch (error) {
      console.error('Error fetching usage stats:', error)
    }
  }

  const refreshUsageStats = useCallback(async () => {
    if (user) {
      await fetchUsageStats(user.id)
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
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
        } catch (dbError) {
          console.error('Error creating user profile:', dbError)
          // Don't fail the signup if profile creation fails
        }
      }
    }

    return { error }
  }

  const signInWithGoogle = async () => {
    return signInWithOAuth('google')
  }

  const signInWithChessCom = async () => {
    return signInWithOAuth('chess_com')
  }

  const signInWithOAuth = async (provider: 'google' | 'lichess' | 'chess_com', returnTo: string = '/') => {
    // Map chess_com to the actual provider name used by Supabase
    const supabaseProvider = provider === 'chess_com' ? 'chess_com' : provider

    // Store returnTo in sessionStorage so we can use it after OAuth callback
    sessionStorage.setItem('auth_return_to', returnTo)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider as any,
      options: {
        redirectTo: `${window.location.origin}/`
      }
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUsageStats(null)
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { error }
  }

  const updateProfile = async (data: Record<string, any>) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) {
        return { error: new Error('Not authenticated') }
      }

      const response = await fetch(`${API_URL}/api/v1/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        return { error: new Error(errorData.detail || 'Failed to update profile') }
      }

      return { error: null }
    } catch (error) {
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
