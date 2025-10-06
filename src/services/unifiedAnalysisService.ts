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
  AnalysisResponse,
  DeepAnalysisData,
  PersonalityScores
} from '../types'
import { config } from '../lib/config'

const UNIFIED_API_URL = config.getApi().baseUrl
console.log('🔧 UNIFIED_API_URL configured as:', UNIFIED_API_URL)

// Re-export types for backward compatibility
export type { GameAnalysisSummary, AnalysisStats, DeepAnalysisData, PersonalityScores } from '../types'

// Fallback personality scores for error handling
const FALLBACK_PERSONALITY: PersonalityScores = {
  tactical: 50,
  positional: 50,
  aggressive: 50,
  patient: 50,
  novelty: 50,
  staleness: 50,
}

// Input validation helpers
function validateUserId(userId: string): boolean {
  return typeof userId === 'string' && userId.trim().length > 0
}

function validatePlatform(platform: string): platform is 'lichess' | 'chess.com' {
  return platform === 'lichess' || platform === 'chess.com'
}

function validatePersonalityScores(scores: any): PersonalityScores | null {
  if (!scores || typeof scores !== 'object') {
    return null
  }

  const requiredTraits = ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']
  const validatedScores: Partial<PersonalityScores> = {}

  for (const trait of requiredTraits) {
    const value = scores[trait]
    if (typeof value === 'number' && !isNaN(value) && value >= 0 && value <= 100) {
      validatedScores[trait] = value
    } else {
      return null // Invalid data
    }
  }

  return validatedScores as PersonalityScores
}

function validateDeepAnalysisData(data: any): DeepAnalysisData | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  // Validate required fields
  const requiredFields = ['total_games', 'average_accuracy', 'current_rating', 'personality_scores']
  for (const field of requiredFields) {
    if (!(field in data)) {
      return null
    }
  }

  // Validate personality scores
  const personalityScores = validatePersonalityScores(data.personality_scores)
  if (!personalityScores) {
    return null
  }

  // Return validated data with defaults for missing fields
  return {
    total_games: Math.max(0, data.total_games || 0),
    average_accuracy: Math.max(0, Math.min(100, data.average_accuracy || 0)),
    current_rating: Math.max(0, data.current_rating || 0),
    personality_scores: personalityScores,
    player_level: data.player_level || 'intermediate',
    player_style: data.player_style || {
      category: 'balanced',
      description: 'Analysis in progress...',
      confidence: 0,
    },
    primary_strengths: Array.isArray(data.primary_strengths) ? data.primary_strengths : ['Analysis in progress...'],
    improvement_areas: Array.isArray(data.improvement_areas) ? data.improvement_areas : ['Analysis in progress...'],
    playing_style: data.playing_style || 'Data unavailable',
    phase_accuracies: {
      opening: Math.max(0, Math.min(100, data.phase_accuracies?.opening || 0)),
      middle: Math.max(0, Math.min(100, data.phase_accuracies?.middle || 0)),
      endgame: Math.max(0, Math.min(100, data.phase_accuracies?.endgame || 0)),
    },
    recommendations: {
      primary: data.recommendations?.primary || 'Complete a Stockfish analysis to unlock deep recommendations.',
      secondary: data.recommendations?.secondary || 'Play a fresh set of games to refresh recent patterns.',
      leverage: data.recommendations?.leverage || 'Review your most accurate games once analysis is ready.',
    },
    famous_players: data.famous_players || null,
    ai_style_analysis: data.ai_style_analysis || null,
    personality_insights: data.personality_insights || null,
  }
}

export interface UnifiedAnalysisRequest {
  user_id: string
  platform: Platform
  analysis_type?: 'stockfish' | 'deep'
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
  status_message?: string
  all_games_analyzed?: boolean
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
      console.log('🌐 Request details:', {
        user_id: requestBody.user_id,
        platform: requestBody.platform,
        analysis_type: requestBody.analysis_type,
        limit: requestBody.limit
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
    analysisType: 'stockfish' | 'deep' = 'stockfish',
    limit: number = 10,
    depth: number = 8,
    skillLevel: number = 8,
    useParallel: boolean = true
  ): Promise<AnalysisResponse> {
    try {
      console.log('🔧 startBatchAnalysis called with:', { userId, platform, analysisType, limit })
      console.log('🔧 User ID type:', typeof userId, 'Value:', JSON.stringify(userId))
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
    analysisType: 'stockfish' | 'deep' = 'stockfish',
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
    analysisType: 'stockfish' | 'deep' = 'stockfish',
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
    analysisType: 'stockfish' | 'deep' = 'stockfish',
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
    analysisType: 'stockfish' | 'deep' = 'stockfish'
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
    analysisType: 'stockfish' | 'deep' = 'stockfish'
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
    analysisType: 'stockfish' | 'deep' = 'stockfish'
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
    const sanitizedUserId = encodeURIComponent(userId.trim())
    const sanitizedPlatform = encodeURIComponent(platform.toLowerCase())
    const url = `${UNIFIED_API_URL}/api/v1/progress/${sanitizedUserId}/${sanitizedPlatform}`

    try {
      console.log('Fetching analysis progress from:', url)
      const response = await fetch(url)

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

  static async getRealtimeAnalysisProgress(
    userId: string,
    platform: Platform,
    analysisType: 'stockfish' | 'deep' = 'stockfish'
  ): Promise<AnalysisProgress | null> {
    const sanitizedUserId = encodeURIComponent(userId.trim())
    const sanitizedPlatform = encodeURIComponent(platform.toLowerCase())
    const progressUrl = `${UNIFIED_API_URL}/api/v1/progress-realtime/${sanitizedUserId}/${sanitizedPlatform}?analysis_type=${analysisType}`

    try {
      console.log('Fetching realtime analysis progress from:', progressUrl)
      const response = await fetch(progressUrl)
      if (response.ok) {
        const realtimeData = await response.json()
        console.log('Realtime progress response:', realtimeData)
        return realtimeData
      }

      console.warn('Realtime progress request failed, status:', response.status)
      const errorText = await response.text()
      console.warn('Error response:', errorText)
    } catch (error) {
      console.error('Error fetching realtime analysis progress:', error)
    }

    // Fall back to the persisted progress endpoint so the UI still shows activity
    return this.getAnalysisProgress(userId, platform)
  }

  /**
   * Get deep analysis with personality insights.
   * Enhanced with validation and fallback handling from DeepAnalysisService
   */
  static async getDeepAnalysis(
    userId: string,
    platform: Platform
  ): Promise<DeepAnalysisData> {
    // Input validation
    if (!validateUserId(userId)) {
      throw new Error('Invalid userId provided')
    }

    if (!validatePlatform(platform)) {
      throw new Error('Invalid platform provided. Must be "lichess" or "chess.com"')
    }

    try {
      const response = await fetch(`${UNIFIED_API_URL}/api/v1/deep-analysis/${userId}/${platform}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const rawData = await response.json()
      const validatedData = validateDeepAnalysisData(rawData)
      
      if (!validatedData) {
        throw new Error('Invalid data format received from server')
      }

      return validatedData
    } catch (error) {
      console.error('Error fetching deep analysis:', error)

      // Return fallback data with neutral personality scores
      return {
        total_games: 0,
        average_accuracy: 0,
        current_rating: 0,
        personality_scores: FALLBACK_PERSONALITY,
        player_level: 'intermediate',
        player_style: {
          category: 'balanced',
          description: 'Fallback data - run a full analysis for personalised insights.',
          confidence: 0,
        },
        primary_strengths: ['Analysis in progress...'],
        improvement_areas: ['Analysis in progress...'],
        playing_style: 'Data unavailable',
        phase_accuracies: {
          opening: 0,
          middle: 0,
          endgame: 0,
        },
        recommendations: {
          primary: 'Complete a Stockfish analysis to unlock deep recommendations.',
          secondary: 'Play a fresh set of games to refresh recent patterns.',
          leverage: 'Review your most accurate games once analysis is ready.',
        },
        famous_players: null,
      }
    }
  }

  /**
   * Enhanced deep analysis fetch function for backward compatibility.
   * This replaces the standalone fetchDeepAnalysis function from DeepAnalysisService.
   */
  static async fetchDeepAnalysis(
    userId: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<DeepAnalysisData> {
    return this.getDeepAnalysis(userId, platform)
  }

  /**
   * Check if analysis API is available.
   * Replaces: AnalysisService.checkHealth
   */
  static async checkHealth(): Promise<boolean> {
    try {
      console.log('🔍 Health check URL:', `${UNIFIED_API_URL}/health`)
      const response = await fetch(`${UNIFIED_API_URL}/health`)
      console.log('🔍 Health check response status:', response.status)
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

  // ============================================================================
  // UNIFIED CONVENIENCE METHODS
  // ============================================================================

  /**
   * Get comprehensive analysis data for a user in one call.
   * Combines stats, results, and deep analysis for complete insights.
   */
  static async getComprehensiveAnalysis(
    userId: string,
    platform: Platform,
    analysisType: 'stockfish' | 'deep' = 'stockfish',
    limit: number = 10
  ): Promise<{
    stats: AnalysisStats | null
    results: GameAnalysisSummary[]
    deepAnalysis: DeepAnalysisData
    progress: AnalysisProgress | null
  }> {
    try {
      const [stats, results, deepAnalysis, progress] = await Promise.all([
        this.getAnalysisStats(userId, platform, analysisType),
        this.getAnalysisResults(userId, platform, limit, analysisType),
        this.getDeepAnalysis(userId, platform),
        this.getAnalysisProgress(userId, platform)
      ])

      return {
        stats,
        results,
        deepAnalysis,
        progress
      }
    } catch (error) {
      console.error('Error getting comprehensive analysis:', error)
      throw new Error('Failed to get comprehensive analysis')
    }
  }
}

// Export default instance for convenience
export default UnifiedAnalysisService

// Export standalone function for backward compatibility
export const fetchDeepAnalysis = UnifiedAnalysisService.fetchDeepAnalysis.bind(UnifiedAnalysisService)



