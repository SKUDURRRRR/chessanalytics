// Profile Service - Manages user profiles and recent users
import { supabase } from '../lib/supabase'
import { normalizeUserId } from '../lib/security'
import { quickCache, getUserExistsCacheKey } from '../utils/quickCache'

export interface UserProfile {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  display_name?: string
  last_accessed: string
  total_games: number
  current_rating: number
  win_rate: number
  most_played_time_control?: string
  most_played_opening?: string
  created_at: string
  updated_at: string
}

export interface RecentUser {
  user_id: string
  platform: 'lichess' | 'chess.com'
  display_name?: string
  last_accessed: string
  total_games: number
  current_rating: number
}

export class ProfileService {


  // Get or create user profile
  static async getOrCreateProfile(
    userId: string,
    platform: 'lichess' | 'chess.com',
    displayName?: string
  ): Promise<UserProfile> {
    try {
      // Use backend API which has service role access
      const API_BASE_URL = import.meta.env.VITE_ANALYSIS_API_URL || 'http://localhost:8000'

      const response = await fetch(`${API_BASE_URL}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
          display_name: displayName || userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to create profile: ${errorData.detail || response.statusText}`)
      }

      const profile = await response.json()
      return profile
    } catch (error) {
      console.error('Error getting/creating profile:', error)
      throw error
    }
  }

  // Check if user profile exists (with 2-minute cache)
  static async checkUserExists(
    userId: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<boolean> {
    const canonicalUserId = normalizeUserId(userId, platform)
    const cacheKey = getUserExistsCacheKey(canonicalUserId, platform)

    // Check cache first (2 minute TTL)
    const cached = quickCache.get<boolean>(cacheKey, 2 * 60 * 1000)
    if (cached !== null) {
      console.log(`User exists check (cached): ${cached}`)
      return cached
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking user exists:', error)
        return false
      }

      const exists = !!data
      // Cache the result
      quickCache.set(cacheKey, exists)
      console.log(`User exists check (fresh): ${exists}`)
      return exists
    } catch (error) {
      console.error('Error checking user exists:', error)
      return false
    }
  }

  // Update last accessed time
  static async updateLastAccessed(
    userId: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<void> {
    const canonicalUserId = normalizeUserId(userId, platform)
    try {
      await supabase
        .from('user_profiles')
        .update({ last_accessed: new Date().toISOString() })
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
    } catch (error) {
      console.error('Error updating last accessed:', error)
    }
  }

  // Update profile with analytics data
  static async updateProfileWithAnalytics(
    userId: string,
    platform: 'lichess' | 'chess.com',
    analyticsData: {
      totalGames: number
      currentRating: number
      winRate: number
      mostPlayedTimeControl?: string
      mostPlayedOpening?: string
    }
  ): Promise<void> {
    const canonicalUserId = normalizeUserId(userId, platform)
    try {
      await supabase
        .from('user_profiles')
        .update({
          total_games: analyticsData.totalGames,
          current_rating: analyticsData.currentRating,
          win_rate: analyticsData.winRate,
          most_played_time_control: analyticsData.mostPlayedTimeControl,
          most_played_opening: analyticsData.mostPlayedOpening,
          last_accessed: new Date().toISOString(),
        })
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
    } catch (error) {
      console.error('Error updating profile with analytics:', error)
    }
  }

  // Get recent users (last 10)
  static async getRecentUsers(): Promise<RecentUser[]> {
    try {
      console.log('Fetching recent users...')
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, platform, display_name, last_accessed, total_games, current_rating')
        .order('last_accessed', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching recent users:', error)
        return []
      }

      console.log('Recent users fetched successfully:', data)
      return data || []
    } catch (error) {
      console.error('Error fetching recent users:', error)
      return []
    }
  }

  // Get all profiles for a specific platform
  static async getProfilesByPlatform(platform: 'lichess' | 'chess.com'): Promise<UserProfile[]> {
    try {
      console.log(`Fetching profiles for platform: ${platform}`)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('platform', platform)
        .order('last_accessed', { ascending: false })

      if (error) {
        console.error('Error fetching profiles by platform:', error)
        return []
      }

      console.log(`Profiles fetched successfully for ${platform}:`, data)
      return data || []
    } catch (error) {
      console.error('Error fetching profiles by platform:', error)
      return []
    }
  }
}
