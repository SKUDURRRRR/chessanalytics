// Analysis Service - Frontend integration with Chess Analysis API
import { supabase } from '../lib/supabase'

const ANALYSIS_API_URL = import.meta.env.VITE_ANALYSIS_API_URL || 'http://localhost:8003'

export interface GameAnalysisSummary {
  game_id: string
  accuracy: number
  blunders: number
  mistakes: number
  inaccuracies: number
  brilliant_moves: number
  opening_accuracy: number
  middle_game_accuracy: number
  endgame_accuracy: number
}

export interface AnalysisStats {
  total_games_analyzed: number
  average_accuracy: number
  total_blunders: number
  total_mistakes: number
  total_inaccuracies: number
  total_brilliant_moves: number
  total_material_sacrifices: number
  average_opening_accuracy: number
  average_middle_game_accuracy: number
  average_endgame_accuracy: number
  average_aggressiveness_index: number
  blunders_per_game: number
  mistakes_per_game: number
  inaccuracies_per_game: number
  brilliant_moves_per_game: number
  material_sacrifices_per_game: number
}

export class AnalysisService {
  // Start analysis for a user
  static async startAnalysis(userId: string, platform: 'lichess' | 'chess.com', limit: number = 10): Promise<{ success: boolean; message: string }> {
    try {
      // Temporarily disable authentication for development
      // const { data: { session } } = await supabase.auth.getSession()
      // const token = session?.access_token
      
      // if (!token) {
      //   throw new Error('No authentication token found. Please log in.')
      // }

      const response = await fetch(`${ANALYSIS_API_URL}/analyze-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
          limit: limit
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error starting analysis:', error)
      throw new Error('Failed to start analysis')
    }
  }

  // Get analysis results for a user
  static async getAnalysisResults(userId: string, platform: 'lichess' | 'chess.com', limit: number = 10): Promise<GameAnalysisSummary[]> {
    try {
      const response = await fetch(`${ANALYSIS_API_URL}/analysis/${userId}/${platform}?limit=${limit}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching analysis results:', error)
      return []
    }
  }

  // Get analysis statistics for a user
  static async getAnalysisStats(userId: string, platform: 'lichess' | 'chess.com'): Promise<AnalysisStats | null> {
    try {
      const url = `${ANALYSIS_API_URL}/analysis-stats/${userId}/${platform}`
      console.log(`Fetching analysis stats from: ${url}`)
      
      const response = await fetch(url)

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status} for user ${userId}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log(`Analysis stats response for ${userId}:`, data)
      return data
    } catch (error) {
      console.error('Error fetching analysis stats:', error)
      return null
    }
  }

  // Check if analysis API is available
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${ANALYSIS_API_URL}/health`)
      return response.ok
    } catch (error) {
      console.error('Analysis API not available:', error)
      return false
    }
  }

  // Get analysis progress
  static async getAnalysisProgress(userId: string, platform: 'lichess' | 'chess.com'): Promise<{
    analyzed_games: number
    total_games: number
    progress_percentage: number
    is_complete: boolean
    current_phase?: 'fetching' | 'analyzing' | 'calculating' | 'saving' | 'complete'
    estimated_time_remaining?: number
  } | null> {
    try {
      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${ANALYSIS_API_URL}/analysis-progress/${userId}/${platform}`, {
        headers
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Analysis progress endpoint not found. Backend may not be running.')
          return null
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching analysis progress:', error)
      // Return null instead of throwing to prevent UI crashes
      return null
    }
  }
}
