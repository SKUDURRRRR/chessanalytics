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

      const response = await fetch(`${ANALYSIS_API_URL}/api/v1/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
          analysis_type: 'basic',
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
    limit: number = 10,
    analysisType: string = 'basic'
  ): Promise<GameAnalysisSummary[]> {
    try {
      const response = await fetch(
        `${ANALYSIS_API_URL}/api/v1/results/${userId}/${platform}?limit=${limit}&analysis_type=${analysisType}`
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Check if we got mock data and log a warning
      if (data.length > 0 && data[0].game_id?.startsWith('mock_game_')) {
        console.warn('⚠️ Received mock analysis results - no real analysis data found in database')
      }
      
      return data
    } catch (error) {
      console.error('Error fetching analysis results:', error)
      return []
    }
  }

  // Get analysis statistics for a user
  static async getAnalysisStats(
    userId: string,
    platform: Platform,
    analysisType: string = 'basic'
  ): Promise<AnalysisStats | null> {
    try {
      const url = `${ANALYSIS_API_URL}/api/v1/stats/${userId}/${platform}?analysis_type=${analysisType}`
      console.log(`Fetching analysis stats from: ${url}`)

      const response = await fetch(url)

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status} for user ${userId}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log(`Analysis stats response for ${userId}:`, data)
      
      // Check if we got mock data and log a warning
      if (data.total_games_analyzed === 15 && data.average_accuracy === 78.5) {
        console.warn('⚠️ Received mock data - no real analysis data found in database')
        console.warn('This usually means:')
        console.warn('1. ✅ Games exist but no analysis has been performed yet - Click "Analyze My Games"')
        console.warn('2. The analysis data is stored under a different analysis_type')
        console.warn('3. There might be a user ID canonicalization issue')
        console.warn('💡 To fix: Run basic analysis on your games to generate real analytics data')
      }
      
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

      const response = await fetch(`${ANALYSIS_API_URL}/api/v1/progress/${userId}/${platform}`, {
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
