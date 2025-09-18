/**
 * Analysis Service - Frontend integration with Chess Analysis API
 * Provides methods for starting analysis, retrieving results, and checking API availability.
 * 
 * @module AnalysisService
 */

import { supabase } from '../lib/supabase'
import {
  GameAnalysisSummary,
  AnalysisStats,
  Platform,
  AnalysisResponse
} from '../types'
import { config } from '../lib/config'
// Error handling imports removed for now to avoid TypeScript issues

const ANALYSIS_API_URL = config.getApi().baseUrl

// Re-export types for backward compatibility
export type { GameAnalysisSummary, AnalysisStats } from '../types'

export class AnalysisService {
  // Start analysis for a user
  static async startAnalysis(
    userId: string,
    platform: Platform,
    limit: number = 10
  ): Promise<AnalysisResponse> {
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
          analysis_type: 'stockfish',
          limit: limit,
          skill_level: 8,
        }),
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
  static async getAnalysisResults(
    userId: string,
    platform: Platform,
    limit: number = 10
  ): Promise<GameAnalysisSummary[]> {
    try {
      const response = await fetch(
        `${ANALYSIS_API_URL}/analysis/${userId}/${platform}?limit=${limit}`
      )

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
  static async getAnalysisStats(
    userId: string,
    platform: Platform
  ): Promise<AnalysisStats | null> {
    try {
      const url = `${ANALYSIS_API_URL}/analysis-stats/${userId}/${platform}?analysis_type=stockfish`
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
  static async getAnalysisProgress(
    userId: string,
    platform: Platform
  ): Promise<{
    analyzed_games: number
    total_games: number
    progress_percentage: number
    is_complete: boolean
    current_phase?: 'fetching' | 'analyzing' | 'calculating' | 'saving' | 'complete'
    estimated_time_remaining?: number
  } | null> {
    try {
      // Get auth token from Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${ANALYSIS_API_URL}/analysis-progress/${userId}/${platform}`, {
        headers,
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
