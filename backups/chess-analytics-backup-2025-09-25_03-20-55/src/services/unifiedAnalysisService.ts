/**
 * Unified Analysis Service - Single service for all analysis operations
 * Replaces multiple analysis services with a clean, unified interface.
 * 
 * @module UnifiedAnalysisService
 */

import {
  GameAnalysisSummary,
  AnalysisStats,
  Platform,
  AnalysisResponse
} from '../types'
import { config } from '../lib/config'

const UNIFIED_API_URL = config.getApi().baseUrl

// Re-export types for backward compatibility
export type { GameAnalysisSummary, AnalysisStats } from '../types'

export interface UnifiedAnalysisRequest {
  user_id: string
  platform: Platform
  analysis_type?: 'basic' | 'stockfish' | 'deep'
  limit?: number
  depth?: number
  skill_level?: number
  pgn?: string
  fen?: string
  move?: string
}

export interface UnifiedAnalysisResponse {
  success: boolean
  message: string
  analysis_id?: string
  data?: any
  progress?: any
}

export interface AnalysisProgress {
  analyzed_games: number
  total_games: number
  progress_percentage: number
  is_complete: boolean
  current_phase?: 'fetching' | 'analyzing' | 'calculating' | 'saving' | 'complete'
  estimated_time_remaining?: number
}

export interface DeepAnalysisData {
  total_games: number
  average_accuracy: number
  current_rating: number
  personality_scores: Record<string, number>
  player_level: string
  player_style: Record<string, any>
  primary_strengths: string[]
  improvement_areas: string[]
  playing_style: string
  phase_accuracies: Record<string, number>
  recommendations: Record<string, string>
}

export class UnifiedAnalysisService {
  /**
   * Unified analysis method that handles all analysis types.
   * Replaces: startAnalysis, analyzePosition, analyzeMove, analyzeGame
   */
  static async analyze(request: UnifiedAnalysisRequest, useParallel: boolean = true): Promise<UnifiedAnalysisResponse> {
    try {
      const requestBody = {
        user_id: request.user_id,
        platform: request.platform,
        analysis_type: request.analysis_type || 'stockfish',
        limit: request.limit || 10,
        depth: request.depth || 8,
        skill_level: request.skill_level || 8,
        ...(request.pgn && { pgn: request.pgn }),
        ...(request.fen && { fen: request.fen }),
        ...(request.move && { move: request.move }),
      }
      
      console.log('🌐 API Request:', {
        url: `${UNIFIED_API_URL}/api/v1/analyze?use_parallel=${useParallel}`,
        body: requestBody
      })
      
      const response = await fetch(`${UNIFIED_API_URL}/api/v1/analyze?use_parallel=${useParallel}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('🌐 API Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('🌐 API Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('🌐 API Response data:', data)
      return data
    } catch (error) {
      console.error('Error in unified analysis:', error)
      throw new Error('Failed to perform analysis')
    }
  }

  /**
   * Start batch analysis for a user's games.
   * Replaces: AnalysisService.startAnalysis
   */
  static async startBatchAnalysis(
    userId: string,
    platform: Platform,
    analysisType: 'basic' | 'stockfish' | 'deep' = 'stockfish',
    limit: number = 10,
    depth: number = 8,
    skillLevel: number = 8,
    useParallel: boolean = true
  ): Promise<AnalysisResponse> {
    try {
      const response = await this.analyze({
        user_id: userId,
        platform: platform,
        analysis_type: analysisType,
        limit: limit,
        depth: depth,
        skill_level: skillLevel
      }, useParallel)

      return {
        success: response.success,
        message: response.message,
        analysis_id: response.analysis_id
      }
    } catch (error) {
      console.error('Error starting batch analysis:', error)
      throw new Error('Failed to start batch analysis')
    }
  }

  /**
   * Analyze a single game from PGN.
   * Replaces: analyzeGame endpoint
   */
  static async analyzeGame(
    pgn: string,
    userId: string,
    platform: Platform,
    analysisType: 'basic' | 'stockfish' | 'deep' = 'stockfish',
    depth: number = 8
  ): Promise<UnifiedAnalysisResponse> {
    try {
      return await this.analyze({
        user_id: userId,
        platform: platform,
        analysis_type: analysisType,
        pgn: pgn,
        depth: depth
      })
    } catch (error) {
      console.error('Error analyzing game:', error)
      throw new Error('Failed to analyze game')
    }
  }

  /**
   * Analyze a chess position.
   * Replaces: analyzePosition endpoint
   */
  static async analyzePosition(
    fen: string,
    analysisType: 'basic' | 'stockfish' | 'deep' = 'stockfish',
    depth: number = 8
  ): Promise<UnifiedAnalysisResponse> {
    try {
      return await this.analyze({
        user_id: 'position_analysis',
        platform: 'lichess',
        analysis_type: analysisType,
        fen: fen,
        depth: depth
      })
    } catch (error) {
      console.error('Error analyzing position:', error)
      throw new Error('Failed to analyze position')
    }
  }

  /**
   * Analyze a specific move in a position.
   * Replaces: analyzeMove endpoint
   */
  static async analyzeMove(
    fen: string,
    move: string,
    analysisType: 'basic' | 'stockfish' | 'deep' = 'stockfish',
    depth: number = 8
  ): Promise<UnifiedAnalysisResponse> {
    try {
      return await this.analyze({
        user_id: 'move_analysis',
        platform: 'lichess',
        analysis_type: analysisType,
        fen: fen,
        move: move,
        depth: depth
      })
    } catch (error) {
      console.error('Error analyzing move:', error)
      throw new Error('Failed to analyze move')
    }
  }

  /**
   * Get analysis results for a user.
   * Replaces: AnalysisService.getAnalysisResults
   */
  static async getAnalysisResults(
    userId: string,
    platform: Platform,
    limit: number = 10,
    analysisType: 'basic' | 'stockfish' | 'deep' = 'stockfish'
  ): Promise<GameAnalysisSummary[]> {
    try {
      const response = await fetch(
        `${UNIFIED_API_URL}/api/v1/results/${userId}/${platform}?limit=${limit}&analysis_type=${analysisType}`
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

  /**
   * Get analysis statistics for a user.
   * Replaces: AnalysisService.getAnalysisStats
   */
  static async getAnalysisStats(
    userId: string,
    platform: Platform,
    analysisType: 'basic' | 'stockfish' | 'deep' = 'stockfish'
  ): Promise<AnalysisStats | null> {
    try {
      const url = `${UNIFIED_API_URL}/api/v1/stats/${userId}/${platform}?analysis_type=${analysisType}`
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

  /**
   * Get individual game analyses for a user.
   * Returns raw game data with moves_analysis for accuracy calculation
   */
  static async getGameAnalyses(
    userId: string,
    platform: Platform,
    analysisType: 'basic' | 'stockfish' | 'deep' = 'stockfish'
  ): Promise<any[]> {
    try {
      const url = `${UNIFIED_API_URL}/api/v1/analyses/${userId}/${platform}?analysis_type=${analysisType}`
      console.log(`Fetching game analyses from: ${url}`)

      const response = await fetch(url)

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status} for user ${userId}`)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log(`Game analyses response for ${userId}:`, data)
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('Error fetching game analyses:', error)
      return []
    }
  }

  /**
   * Get analysis progress for a user.
   * Replaces: AnalysisService.getAnalysisProgress
   */
  static async getAnalysisProgress(
    userId: string,
    platform: Platform
  ): Promise<AnalysisProgress | null> {
    try {
      const response = await fetch(`${UNIFIED_API_URL}/api/v1/progress/${userId}/${platform}`)

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
      return null
    }
  }

  /**
   * Get deep analysis with personality insights.
   * New functionality for advanced analysis
   */
  static async getDeepAnalysis(
    userId: string,
    platform: Platform
  ): Promise<DeepAnalysisData | null> {
    try {
      const response = await fetch(`${UNIFIED_API_URL}/api/v1/deep-analysis/${userId}/${platform}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching deep analysis:', error)
      return null
    }
  }

  /**
   * Check if analysis API is available.
   * Replaces: AnalysisService.checkHealth
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${UNIFIED_API_URL}/health`)
      return response.ok
    } catch (error) {
      console.error('Analysis API not available:', error)
      return false
    }
  }

  /**
   * Get API information and available features.
   * New functionality for API discovery
   */
  static async getApiInfo(): Promise<any> {
    try {
      const response = await fetch(`${UNIFIED_API_URL}/`)
      return await response.json()
    } catch (error) {
      console.error('Error fetching API info:', error)
      return null
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR BACKWARD COMPATIBILITY
  // ============================================================================

  /**
   * Backward compatibility method for existing code.
   * @deprecated Use startBatchAnalysis instead
   */
  static async startAnalysis(
    userId: string,
    platform: Platform,
    limit: number = 10
  ): Promise<AnalysisResponse> {
    console.warn('startAnalysis is deprecated. Use startBatchAnalysis instead.')
    return this.startBatchAnalysis(userId, platform, 'stockfish', limit)
  }

  /**
   * Backward compatibility method for existing code.
   * @deprecated Use getAnalysisResults instead
   */
  static async getResults(
    userId: string,
    platform: Platform,
    limit: number = 10
  ): Promise<GameAnalysisSummary[]> {
    console.warn('getResults is deprecated. Use getAnalysisResults instead.')
    return this.getAnalysisResults(userId, platform, limit)
  }

  /**
   * Backward compatibility method for existing code.
   * @deprecated Use getAnalysisStats instead
   */
  static async getStats(
    userId: string,
    platform: Platform
  ): Promise<AnalysisStats | null> {
    console.warn('getStats is deprecated. Use getAnalysisStats instead.')
    return this.getAnalysisStats(userId, platform)
  }
}

// Export default instance for convenience
export default UnifiedAnalysisService

