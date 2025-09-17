// Profile Service - Manages user profiles and recent users
import { supabase } from '../lib/supabase'

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
      // Try to get existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .maybeSingle()

      // If profile exists and no error, return it
      if (existingProfile && !fetchError) {
        // Update last accessed time
        await this.updateLastAccessed(userId, platform)
        return existingProfile
      }

      // If error is "not found", continue to create profile
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.warn('Error fetching existing profile:', fetchError)
        // Continue to create profile anyway
      }

      // Create new profile
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          platform: platform,
          display_name: displayName || userId,
          current_rating: 1200,
          total_games: 0,
          win_rate: 0
        })
        .select()
        .single()

      if (createError) {
        throw new Error(`Failed to create profile: ${createError.message}`)
      }

      return newProfile
    } catch (error) {
      console.error('Error getting/creating profile:', error)
      throw error
    }
  }

  // Update last accessed time
  static async updateLastAccessed(
    userId: string, 
    platform: 'lichess' | 'chess.com'
  ): Promise<void> {
    try {
      await supabase
        .from('user_profiles')
        .update({ last_accessed: new Date().toISOString() })
        .eq('user_id', userId)
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
    try {
      await supabase
        .from('user_profiles')
        .update({
          total_games: analyticsData.totalGames,
          current_rating: analyticsData.currentRating,
          win_rate: analyticsData.winRate,
          most_played_time_control: analyticsData.mostPlayedTimeControl,
          most_played_opening: analyticsData.mostPlayedOpening,
          last_accessed: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('platform', platform)
    } catch (error) {
      console.error('Error updating profile with analytics:', error)
    }
  }

  // Get recent users (last 10)
  static async getRecentUsers(): Promise<RecentUser[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, platform, display_name, updated_at, total_games, current_rating')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (error) {
        console.warn('Error fetching recent users:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.warn('Error fetching recent users:', error)
      return []
    }
  }

  // Get all profiles for a specific platform
  static async getProfilesByPlatform(platform: 'lichess' | 'chess.com'): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('platform', platform)
        .order('last_accessed', { ascending: false })

      if (error) {
        console.warn('Error fetching profiles by platform:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.warn('Error fetching profiles by platform:', error)
      return []
    }
  }

}
