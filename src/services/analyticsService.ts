// Analytics Service - Track and retrieve admin dashboard metrics

import { fetchWithTimeout } from '../utils/fetchWithTimeout'
import { config } from '../lib/config'
import { supabase } from '../lib/supabase'

const API_BASE_URL = config.getApi().baseUrl

export interface DashboardMetrics {
  success: boolean
  start_date: string
  end_date: string
  granularity: 'hour' | 'day' | 'week' | 'month'
  metrics: {
    player_search?: TimeSeriesData[]
    game_analysis?: TimeSeriesData[]
    pricing_page_view?: TimeSeriesData[]
    user_registration?: TimeSeriesData[]
  }
}

export interface TimeSeriesData {
  time_bucket: string
  event_count: number
  unique_users: number
  anonymous_count: number
  unique_ips: number
}

export interface RegistrationStats {
  success: boolean
  start_date: string
  end_date: string
  stats: {
    total_registrations: number
    completed_registrations: number
    incomplete_registrations: number
    completion_rate: number
  }
}

export interface UserAnalysisStats {
  success: boolean
  start_date: string
  end_date: string
  users: Array<{
    user_email: string
    analysis_count: number
    first_analysis: string
    last_analysis: string
    platforms: string[]
    players_analyzed: Array<{
      username: string
      platform: string
      count: number
    }>
  }>
}

export interface PlayerSearchStats {
  success: boolean
  start_date: string
  end_date: string
  players: Array<{
    username: string
    platform: string
    search_count: number
    last_searched: string
  }>
}

export interface AnalyzedPlayersStats {
  success: boolean
  start_date: string
  end_date: string
  players: Array<{
    player_username: string
    platform: string
    analysis_count: number
    analyzer_emails: string[]
    last_analyzed: string
  }>
}

export interface RegistrationDetails {
  success: boolean
  start_date: string
  end_date: string
  registrations: Array<{
    user_email: string
    registration_date: string
    has_profile: boolean
    is_completed: boolean
  }>
}

export class AnalyticsService {
  /**
   * Track an analytics event (player search, game analysis, pricing page view)
   */
  static async trackEvent(
    eventType: 'player_search' | 'game_analysis' | 'pricing_page_view',
    metadata?: {
      platform?: 'lichess' | 'chess.com'
      username?: string
      game_id?: string
      analysis_type?: string
    }
  ): Promise<void> {
    try {
      // Get auth token if user is logged in
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      await fetchWithTimeout(`${API_BASE_URL}/api/v1/admin/track-event`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event_type: eventType,
          platform: metadata?.platform,
          metadata: {
            username: metadata?.username,
            game_id: metadata?.game_id,
            analysis_type: metadata?.analysis_type,
          },
        }),
      })
    } catch (error) {
      // Silently fail - tracking should not interrupt user experience
      console.warn('Failed to track analytics event:', error)
    }
  }

  /**
   * Track a player search event
   */
  static async trackPlayerSearch(
    username: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<void> {
    return this.trackEvent('player_search', { username, platform })
  }

  /**
   * Track a game analysis event
   */
  static async trackGameAnalysis(
    gameId: string,
    platform: 'lichess' | 'chess.com',
    analysisType: string
  ): Promise<void> {
    return this.trackEvent('game_analysis', { game_id: gameId, platform, analysis_type: analysisType })
  }

  /**
   * Track a pricing page view
   */
  static async trackPricingPageView(): Promise<void> {
    return this.trackEvent('pricing_page_view')
  }

  /**
   * Get dashboard metrics
   */
  static async getDashboardMetrics(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' | 'month'
  ): Promise<DashboardMetrics> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // For local development, allow without auth (backend will use service role)
      // if (!token) {
      //   throw new Error('Authentication required')
      // }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/admin/dashboard-metrics`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          granularity,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Dashboard metrics API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          url: `${API_BASE_URL}/api/v1/admin/dashboard-metrics`,
        })
        throw new Error(`Failed to fetch dashboard metrics: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
      throw error
    }
  }

  /**
   * Get registration statistics
   */
  static async getRegistrationStats(
    startDate: Date,
    endDate: Date
  ): Promise<RegistrationStats> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // For local development, allow without auth
      // if (!token) {
      //   throw new Error('Authentication required')
      // }

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/admin/registration-stats?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`,
        { headers }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Registration stats API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          url: `${API_BASE_URL}/api/v1/admin/registration-stats`,
        })
        throw new Error(`Failed to fetch registration stats: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching registration stats:', error)
      throw error
    }
  }

  /**
   * Refresh analytics materialized views
   */
  static async refreshAnalyticsViews(): Promise<void> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('Authentication required')
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/v1/admin/refresh-analytics`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh analytics views: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error refreshing analytics views:', error)
      throw error
    }
  }

  /**
   * Get user analysis statistics
   */
  static async getUserAnalysisStats(
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<UserAnalysisStats> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/admin/user-analysis-stats?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&limit=${limit}`,
        { headers }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('User analysis stats API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        throw new Error(`Failed to fetch user analysis stats: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching user analysis stats:', error)
      throw error
    }
  }

  /**
   * Get player search statistics
   */
  static async getPlayerSearchStats(
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<PlayerSearchStats> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/admin/player-search-stats?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&limit=${limit}`,
        { headers }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Player search stats API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        throw new Error(`Failed to fetch player search stats: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching player search stats:', error)
      throw error
    }
  }

  /**
   * Get statistics about which players' games were analyzed
   */
  static async getAnalyzedPlayersStats(
    startDate: Date,
    endDate: Date,
    limit: number = 50
  ): Promise<AnalyzedPlayersStats> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/admin/analyzed-players-stats?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&limit=${limit}`,
        { headers }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Analyzed players stats API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        throw new Error(`Failed to fetch analyzed players stats: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching analyzed players stats:', error)
      throw error
    }
  }

  /**
   * Get detailed registration information
   */
  static async getRegistrationDetails(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<RegistrationDetails> {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/admin/registration-details?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&limit=${limit}`,
        { headers }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Registration details API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })
        throw new Error(`Failed to fetch registration details: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching registration details:', error)
      throw error
    }
  }
}
