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
import { withCache, generateCacheKey, apiCache } from '../utils/apiCache'
import { logger } from '../utils/logger'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'
import { supabase } from '../lib/supabase'

const UNIFIED_API_URL = config.getApi().baseUrl
logger.log('🔧 UNIFIED_API_URL configured as:', UNIFIED_API_URL)

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

  const requiredTraits: (keyof PersonalityScores)[] = ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']
  const validatedScores: Partial<PersonalityScores> = {}

  for (const trait of requiredTraits) {
    const value = scores[trait]
    if (typeof value === 'number' && !isNaN(value) && value >= 0 && value <= 100) {
      (validatedScores as any)[trait] = value
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
    enhanced_opening_analysis: data.enhanced_opening_analysis || undefined,
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

      logger.log('🌐 API Request:', {
        url: `${UNIFIED_API_URL}/api/v1/analyze?use_parallel=${useParallel}`,
        body: requestBody
      })
      logger.log('🌐 Request details:', {
        user_id: requestBody.user_id,
        platform: requestBody.platform,
        analysis_type: requestBody.analysis_type,
        limit: requestBody.limit
      })

      // Get auth token if user is logged in
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
          logger.log('🌐 Added Authorization header for authenticated user')
        }
      } catch (error) {
        // Log but don't fail - allow request to proceed without auth (for anonymous users)
        logger.log('🌐 No auth session found, proceeding without Authorization header')
      }

      // Use longer timeout for deep analysis (can take 3-5 minutes for complex games)
      const timeout = requestBody.analysis_type === 'deep'
        ? TIMEOUT_CONFIG.DEEP_ANALYSIS
        : TIMEOUT_CONFIG.LONG

      const response = await fetchWithTimeout(
        `${UNIFIED_API_URL}/api/v1/analyze?use_parallel=${useParallel}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        },
        timeout
      )

      logger.log('🌐 API Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('🌐 API Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      logger.log('🌐 API Response data:', data)
      return data
    } catch (error) {
      logger.error('Error in unified analysis:', error)

      // Preserve the original error message for better debugging
      if (error instanceof Error) {
        // If it's already a detailed error (like from fetchWithTimeout), throw it as-is
        if (error.message.includes('Network error') || error.message.includes('Request timeout')) {
          throw error;
        }
        throw new Error(`Failed to perform analysis: ${error.message}`)
      }

      throw new Error('Failed to perform analysis: Unknown error')
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
    const cacheKey = generateCacheKey('stats', userId, platform, { analysisType })

    // Validator: ensure we have valid stats with total_games_analyzed
    const statsValidator = (data: AnalysisStats | null) => {
      return data !== null && typeof data.total_games_analyzed === 'number'
    }

    return withCache(cacheKey, async () => {
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
    }, 60 * 60 * 1000, statsValidator) // 60 minute cache for stats (was 10 min - backend is very slow, cache aggressively)
  }

  /**
   * Get individual game analyses for a user with pagination support.
   * Returns raw game data with moves_analysis for accuracy calculation
   */
  static async getGameAnalyses(
    userId: string,
    platform: Platform,
    analysisType: 'stockfish' | 'deep' = 'stockfish',
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    const cacheKey = generateCacheKey('analyses', userId, platform, { analysisType, limit, offset })

    // Validator: ensure we have a valid array (empty array is valid)
    const analysesValidator = (data: any[]) => {
      return Array.isArray(data)
    }

    return withCache(cacheKey, async () => {
      try {
        const url = `${UNIFIED_API_URL}/api/v1/analyses/${userId}/${platform}?analysis_type=${analysisType}&limit=${limit}&offset=${offset}`
        console.log(`Fetching game analyses from: ${url}`)

        const response = await fetch(url)

        if (!response.ok) {
          console.error(`HTTP error! status: ${response.status} for user ${userId}`)
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log(`Game analyses response for ${userId}: ${Array.isArray(data) ? data.length : 0} records`)
        return Array.isArray(data) ? data : []
      } catch (error) {
        console.error('Error fetching game analyses:', error)
        return []
      }
    }, 15 * 60 * 1000, analysesValidator) // 15 minute cache for game analyses (was 5 min - increased for better performance)
  }

  /**
   * Get the total count of game analyses for a user.
   */
  static async getGameAnalysesCount(
    userId: string,
    platform: Platform,
    analysisType: 'stockfish' | 'deep' = 'stockfish'
  ): Promise<number> {
    try {
      const url = `${UNIFIED_API_URL}/api/v1/analyses/${userId}/${platform}/count?analysis_type=${analysisType}`
      console.log(`Fetching game analyses count from: ${url}`)

      const response = await fetch(url)

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status} for user ${userId}`)
        return 0
      }

      const data = await response.json()
      return data.count || 0
    } catch (error) {
      console.error('Error fetching game analyses count:', error)
      return 0
    }
  }

  /**
   * Efficiently check which games from a list are already analyzed.
   * This is optimized for Match History to quickly check analyze button states.
   * Only fetches game_id, provider_game_id, and accuracy - not full analysis data.
   */
  static async checkGamesAnalyzed(
    userId: string,
    platform: Platform,
    gameIds: string[],
    analysisType: 'stockfish' | 'deep' = 'stockfish'
  ): Promise<Map<string, { game_id: string; provider_game_id: string | null; accuracy: number | null }>> {
    if (!gameIds || gameIds.length === 0) {
      return new Map()
    }

    try {
      const url = `${UNIFIED_API_URL}/api/v1/analyses/${userId}/${platform}/check?analysis_type=${analysisType}`
      console.log(`Checking analyzed games from: ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameIds),
      })

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status} for user ${userId}`)
        return new Map()
      }

      const data = await response.json()
      const analyzedGames = data.analyzed_games || []

      // Create a map for fast lookups by both game_id and provider_game_id
      const resultMap = new Map<string, { game_id: string; provider_game_id: string | null; accuracy: number | null }>()

      analyzedGames.forEach((game: any) => {
        const gameData = {
          game_id: game.game_id,
          provider_game_id: game.provider_game_id,
          accuracy: game.accuracy
        }

        if (game.game_id) {
          resultMap.set(game.game_id, gameData)
        }
        if (game.provider_game_id) {
          resultMap.set(game.provider_game_id, gameData)
        }
      })

      console.log(`Found ${analyzedGames.length} analyzed games out of ${gameIds.length} requested`)
      return resultMap
    } catch (error) {
      console.error('Error checking analyzed games:', error)
      return new Map()
    }
  }

  /**
   * Poll for AI comments status on a specific game.
   * Returns the ai_comments_status: 'pending', 'generating', or 'completed'
   */
  static async getAICommentsStatus(
    userId: string,
    platform: Platform,
    gameId: string
  ): Promise<'pending' | 'generating' | 'completed' | null> {
    try {
      const sanitizedUserId = encodeURIComponent(userId.trim())
      const sanitizedPlatform = encodeURIComponent(platform.toLowerCase())
      const sanitizedGameId = encodeURIComponent(gameId.trim())
      // Use the same endpoint as fetchGameAnalysisData
      const url = `${UNIFIED_API_URL}/api/v1/game/${sanitizedUserId}/${sanitizedPlatform}/${sanitizedGameId}`

      const response = await fetch(url)
      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.ai_comments_status || 'pending'
    } catch (error) {
      console.error('Error fetching AI comments status:', error)
      return null
    }
  }

  /**
   * Poll for AI comments to be ready, with automatic retries.
   * Shows toast notification when comments are ready.
   *
   * @param gameId - The game ID to poll for
   * @param maxAttempts - Maximum number of polling attempts (default: 12 = ~60 seconds)
   * @param pollInterval - Polling interval in milliseconds (default: 5000 = 5 seconds)
   * @param onComplete - Callback when comments are ready
   * @param onError - Callback on error
   */
  static async pollForAIComments(
    userId: string,
    platform: Platform,
    gameId: string,
    maxAttempts: number = 12,
    pollInterval: number = 5000,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    let attempts = 0

    const poll = async (): Promise<void> => {
      attempts++

      try {
        const status = await this.getAICommentsStatus(userId, platform, gameId)

        if (status === 'completed') {
          // Comments are ready!
          if (onComplete) {
            onComplete()
          }
          // Show toast notification
          if (typeof window !== 'undefined' && (window as any).toast) {
            (window as any).toast.success('AI insights ready!')
          } else {
            console.log('✅ AI insights ready!')
          }
          return
        }

        if (attempts >= maxAttempts) {
          // Max attempts reached, stop polling
          console.log(`⏱️ AI comments polling stopped after ${attempts} attempts`)
          return
        }

        // Continue polling
        setTimeout(poll, pollInterval)
      } catch (error) {
        console.error('Error polling for AI comments:', error)
        if (onError) {
          onError(error as Error)
        }
      }
    }

    // Start polling
    poll()
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
    platform: Platform,
    forceRefresh = false
  ): Promise<DeepAnalysisData> {
    // Input validation
    if (!validateUserId(userId)) {
      throw new Error('Invalid userId provided')
    }

    if (!validatePlatform(platform)) {
      throw new Error('Invalid platform provided. Must be "lichess" or "chess.com"')
    }

    const cacheKey = generateCacheKey('deep-analysis', userId, platform)

    // Validator: ensure we have valid deep analysis data
    const deepAnalysisValidator = (data: DeepAnalysisData) => {
      return data && typeof data.total_games === 'number' && data.personality_scores !== undefined
    }

    // If forceRefresh is true, skip cache and fetch directly
    if (forceRefresh) {
      if (import.meta.env.DEV) {
        console.log('[DeepAnalysis] Force refresh - bypassing cache')
      }
      apiCache.delete(cacheKey)
    }

    return withCache(cacheKey, async () => {
      try {
        const url = forceRefresh
          ? `${UNIFIED_API_URL}/api/v1/deep-analysis/${userId}/${platform}?force_refresh=true`
          : `${UNIFIED_API_URL}/api/v1/deep-analysis/${userId}/${platform}`

        const response = await fetch(url, {
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
        famous_players: undefined,
      }
    }
    }, 60 * 60 * 1000, deepAnalysisValidator) // 60 minute cache for deep analysis (was 30 min - backend is very slow, cache aggressively)
  }

  /**
   * Enhanced deep analysis fetch function for backward compatibility.
   * This replaces the standalone fetchDeepAnalysis function from DeepAnalysisService.
   */
  static async fetchDeepAnalysis(
    userId: string,
    platform: 'lichess' | 'chess.com',
    forceRefresh = false
  ): Promise<DeepAnalysisData> {
    return this.getDeepAnalysis(userId, platform, forceRefresh)
  }

  /**
   * Clear all backend cache for a user
   */
  static async clearBackendCache(
    userId: string,
    platform: Platform
  ): Promise<void> {
    try {
      const response = await fetch(`${UNIFIED_API_URL}/api/v1/clear-cache/${userId}/${platform}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(`Failed to clear backend cache: ${response.status}`)
        return
      }

      const data = await response.json()
      console.log('[Cache] Backend cache cleared:', data)
    } catch (error) {
      console.error('Error clearing backend cache:', error)
    }
  }

  /**
   * Get ELO statistics from backend API
   * This includes highest rating, time control, and total games
   */
  static async getEloStats(
    userId: string,
    platform: Platform
  ): Promise<{
    highest_elo: number | null
    time_control: string | null
    game_id: string | null
    played_at: string | null
    total_games: number
  }> {
    if (!validateUserId(userId) || !validatePlatform(platform)) {
      console.error('Invalid userId or platform for getEloStats')
      return {
        highest_elo: null,
        time_control: null,
        game_id: null,
        played_at: null,
        total_games: 0
      }
    }

    try {
      const response = await fetch(`${UNIFIED_API_URL}/api/v1/elo-stats/${userId}/${platform}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error(`Failed to fetch ELO stats: ${response.status}`)
        return {
          highest_elo: null,
          time_control: null,
          game_id: null,
          played_at: null,
          total_games: 0
        }
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching ELO stats:', error)
      return {
        highest_elo: null,
        time_control: null,
        game_id: null,
        played_at: null,
        total_games: 0
      }
    }
  }

  /**
   * Get comprehensive game analytics (replaces comprehensiveGameAnalytics.ts)
   */
  static async getComprehensiveAnalytics(
    userId: string,
    platform: Platform,
    limit: number = 500
  ): Promise<{
    total_games: number
    games: any[]
    sample_size: number
  }> {
    if (!validateUserId(userId) || !validatePlatform(platform)) {
      console.error('Invalid userId or platform for getComprehensiveAnalytics')
      return {
        total_games: 0,
        games: [],
        sample_size: 0
      }
    }

    // Include version in cache key to force refresh after backend fix for full game stats
    const cacheKey = generateCacheKey('comprehensive', userId, platform, { limit, v: '5' })

    // Validator: ensure we have valid comprehensive analytics data
    const comprehensiveValidator = (data: any) => {
      return data !== null &&
        typeof data.total_games === 'number' &&
        Array.isArray(data.games) &&
        data.games.length > 0
    }

    return withCache(cacheKey, async () => {
      try {
        const response = await fetch(
          `${UNIFIED_API_URL}/api/v1/comprehensive-analytics/${userId}/${platform}?limit=${limit}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) {
          console.error(`Failed to fetch comprehensive analytics: ${response.status}`)
          return {
            total_games: 0,
            games: [],
            sample_size: 0
          }
        }

        const data = await response.json()
        return data
      } catch (error) {
        console.error('Error fetching comprehensive analytics:', error)
        return {
          total_games: 0,
          games: [],
          sample_size: 0
        }
      }
    }, 30 * 60 * 1000, comprehensiveValidator) // 30 minute cache for comprehensive analytics
  }

  /**
   * Get ELO history for trend graph (replaces EloTrendGraph.tsx direct queries)
   */
  static async getEloHistory(
    userId: string,
    platform: Platform,
    limit: number = 500
  ): Promise<any[]> {
    if (!validateUserId(userId) || !validatePlatform(platform)) {
      console.error('Invalid userId or platform for getEloHistory')
      return []
    }

    try {
      const response = await fetch(
        `${UNIFIED_API_URL}/api/v1/elo-history/${userId}/${platform}?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        console.error(`Failed to fetch ELO history: ${response.status}`)
        return []
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching ELO history:', error)
      return []
    }
  }

  /**
   * Get player stats (replaces playerStats.ts direct queries)
   */
  static async getPlayerStats(
    userId: string,
    platform: Platform
  ): Promise<{
    highest_elo: number | null
    time_control_with_highest_elo: string | null
    game_id?: string
    played_at?: string
    opponent_rating?: number
    color?: string
    validation_issues: string[]
  }> {
    if (!validateUserId(userId) || !validatePlatform(platform)) {
      console.error('Invalid userId or platform for getPlayerStats')
      return {
        highest_elo: null,
        time_control_with_highest_elo: null,
        validation_issues: []
      }
    }

    try {
      const response = await fetch(
        `${UNIFIED_API_URL}/api/v1/player-stats/${userId}/${platform}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        console.error(`Failed to fetch player stats: ${response.status}`)
        return {
          highest_elo: null,
          time_control_with_highest_elo: null,
          validation_issues: []
        }
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching player stats:', error)
      return {
        highest_elo: null,
        time_control_with_highest_elo: null,
        validation_issues: []
      }
    }
  }

  /**
   * Get match history (replaces MatchHistory.tsx direct queries)
   */
  static async getMatchHistory(
    userId: string,
    platform: Platform,
    page: number = 1,
    limit: number = 20,
    filters?: {
      opening?: string
      opponent?: string
      color?: 'white' | 'black'
    }
  ): Promise<any[]> {
    if (!validateUserId(userId) || !validatePlatform(platform)) {
      console.error('Invalid userId or platform for getMatchHistory')
      return []
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      if (filters?.opening) {
        params.append('opening_filter', filters.opening)
      }
      if (filters?.opponent) {
        params.append('opponent_filter', filters.opponent)
      }
      if (filters?.color) {
        params.append('color_filter', filters.color)
      }

      const response = await fetch(
        `${UNIFIED_API_URL}/api/v1/match-history/${userId}/${platform}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        console.error(`Failed to fetch match history: ${response.status}`)
        return []
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching match history:', error)
      return []
    }
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
