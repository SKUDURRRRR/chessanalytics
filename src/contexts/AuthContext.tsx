// Enhanced Authentication Context with Usage Tracking
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  email: string
  username?: string
  accountTier?: string
}

interface UsageStats {
  accountTier?: string
  tierName?: string
  isUnlimited?: boolean
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
  resetsInHours?: number
}

interface AuthContextType {
  user: User | null
  loading: boolean
  usageStats: UsageStats | null
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  signInWithOAuth: (provider: 'google' | 'lichess') => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  updateProfile: (data: { username?: string }) => Promise<{ error: any }>
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
          email: session.user.email!,
          username: session.user.user_metadata?.username
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
          email: session.user.email!,
          username: session.user.user_metadata?.username
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

  const refreshUsageStats = async () => {
    if (user) {
      await fetchUsageStats(user.id)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        },
        emailRedirectTo: `${window.location.origin}/profile`
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
            username: username,
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

  const signInWithOAuth = async (provider: 'google' | 'lichess') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/profile`
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

  const updateProfile = async (data: { username?: string }) => {
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

      // Update local user state
      if (data.username && user) {
        setUser({ ...user, username: data.username })
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
